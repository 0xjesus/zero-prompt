import { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ----------------------------------------------------------------
// x402 MIDDLEWARE - USDC EIP-3009 Payments (Avalanche Only)
// ----------------------------------------------------------------

const SERVER_PRIVATE_KEY = process.env.PRIVATE_KEY;
const MERCHANT_ADDRESS = process.env.X402_MERCHANT_ADDRESS || "0x209F0baCA0c23edc57881B26B68FC4148123B039";

// Avalanche config
const AVALANCHE_RPC = 'https://api.avax.network/ext/bc/C/rpc';
const AVALANCHE_CHAIN_ID = 43114;
const AVALANCHE_USDC = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E';

// USDC ABI for transferWithAuthorization (EIP-3009)
const USDC_ABI = [
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
  'function balanceOf(address account) view returns (uint256)',
  'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
];

console.log(`[x402] Merchant Address: ${MERCHANT_ADDRESS}`);
console.log(`[x402] Server wallet configured: ${SERVER_PRIVATE_KEY ? 'Yes' : 'No'}`);
console.log(`[x402] Network: Avalanche (${AVALANCHE_CHAIN_ID})`);

interface X402Options {
  price: string;
  resourceId: string;
  description: string;
}

/**
 * x402 Middleware - USDC EIP-3009 Payments on Avalanche
 */
export const x402Middleware = (options: X402Options) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers['x-payment'] as string | undefined;

    // ----------------------------------------------------------------
    // NO PAYMENT -> RETURN 402 CHALLENGE
    // ----------------------------------------------------------------
    if (!paymentHeader) {
      return res.status(402).json({
        x402Version: 2,
        accepts: [{
          scheme: "x402-eip3009",
          network: "avalanche",
          chainId: AVALANCHE_CHAIN_ID,
          token: AVALANCHE_USDC,
          tokenSymbol: "USDC",
          price: options.price,
          resource: options.resourceId,
          description: options.description,
          payTo: MERCHANT_ADDRESS,
          maxTimeoutSeconds: 600,
          gasSponsored: true,
        }],
        error: "Payment required",
        hint: `Pay $${options.price} USDC on Avalanche. Gas is sponsored!`,
      });
    }

    // ----------------------------------------------------------------
    // VERIFY AND EXECUTE PAYMENT
    // ----------------------------------------------------------------
    try {
      const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
      const paymentData = JSON.parse(decoded);

      console.log('[x402] Payment received:', paymentData.scheme);

      if (paymentData.scheme === 'x402-eip3009') {
        await handleEIP3009Payment(req, res, next, paymentData, options);
      } else if (paymentData.scheme === 'x402-native') {
        await handleNativePayment(req, res, next, paymentData, options);
      } else {
        throw new Error(`Unknown payment scheme: ${paymentData.scheme}`);
      }

    } catch (error: any) {
      console.error("[x402] Payment error:", error.message);

      // Log failed payment attempt
      try {
        const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
        const paymentData = JSON.parse(decoded);
        const from = paymentData.payload?.from || 'unknown';
        await prisma.x402Payment.create({
          data: {
            fromAddress: from,
            toAddress: MERCHANT_ADDRESS,
            amountUSDC: '0',
            priceUSD: options.price,
            endpoint: options.resourceId,
            model: req.body?.model || null,
            status: 'failed',
            errorMessage: error.message,
          },
        });
      } catch (dbError) {
        // Ignore DB errors for failed payment logging
      }

      return res.status(402).json({
        x402Version: 2,
        error: error.message,
        accepts: [{
          scheme: "x402-eip3009",
          network: "avalanche",
          chainId: AVALANCHE_CHAIN_ID,
          token: AVALANCHE_USDC,
          price: options.price,
          payTo: MERCHANT_ADDRESS,
          gasSponsored: true,
        }],
        hint: "Please try again",
      });
    }
  };
};

/**
 * Handle EIP-3009 USDC payment on Avalanche
 */
async function handleEIP3009Payment(
  req: Request,
  res: Response,
  next: NextFunction,
  paymentData: any,
  options: X402Options
) {
  if (!SERVER_PRIVATE_KEY) {
    throw new Error('Server wallet not configured');
  }

  const { payload } = paymentData;
  const { from, to, value, validAfter, validBefore, nonce, signature } = payload;

  // Verify recipient
  if (to.toLowerCase() !== MERCHANT_ADDRESS.toLowerCase()) {
    throw new Error(`Invalid recipient: ${to}`);
  }

  // Verify amount (USDC = 6 decimals)
  const requiredAmount = BigInt(Math.ceil(parseFloat(options.price) * 1_000_000));
  if (BigInt(value) < requiredAmount) {
    throw new Error(`Insufficient amount: ${value} < ${requiredAmount}`);
  }

  // Validate time
  const now = Math.floor(Date.now() / 1000);
  if (now < parseInt(validAfter)) throw new Error('Authorization not yet valid');
  if (now > parseInt(validBefore)) throw new Error('Authorization expired');

  console.log(`[x402] Processing: ${from} -> ${to}, ${ethers.formatUnits(value, 6)} USDC`);

  // Connect to Avalanche
  const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC);
  const serverWallet = new ethers.Wallet(SERVER_PRIVATE_KEY, provider);
  const usdcContract = new ethers.Contract(AVALANCHE_USDC, USDC_ABI, serverWallet);

  // Check nonce
  const nonceUsed = await usdcContract.authorizationState(from, nonce);
  if (nonceUsed) throw new Error('Nonce already used');

  // Check balance
  const balance = await usdcContract.balanceOf(from);
  if (balance < BigInt(value)) {
    throw new Error(`Insufficient USDC: ${ethers.formatUnits(balance, 6)} < ${ethers.formatUnits(value, 6)}`);
  }

  // Split signature
  const sig = ethers.Signature.from(signature);

  console.log(`[x402] Executing transferWithAuthorization...`);

  // Execute (server pays gas!)
  const tx = await usdcContract.transferWithAuthorization(
    from, to, value, validAfter, validBefore, nonce,
    sig.v, sig.r, sig.s
  );

  console.log(`[x402] Tx sent: ${tx.hash}`);

  const receipt = await tx.wait(1);
  if (receipt.status !== 1) throw new Error('Transaction failed');

  console.log(`[x402] ✓ Payment confirmed! Block: ${receipt.blockNumber}`);

  // Log payment to database
  const modelUsed = req.body?.model || null;
  try {
    await prisma.x402Payment.create({
      data: {
        txHash: tx.hash,
        fromAddress: from,
        toAddress: to,
        amountUSDC: ethers.formatUnits(value, 6),
        priceUSD: options.price,
        endpoint: options.resourceId,
        model: modelUsed,
        status: 'success',
      },
    });
    console.log(`[x402] ✓ Payment logged to DB`);
  } catch (dbError: any) {
    console.error(`[x402] DB log error:`, dbError.message);
  }

  (req as any).x402 = {
    settled: true,
    payer: from,
    amount: ethers.formatUnits(value, 6),
    currency: 'USDC',
    network: 'avalanche',
    txHash: tx.hash,
  };

  res.setHeader('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify({
    success: true,
    txHash: tx.hash,
    network: 'avalanche',
  })).toString('base64'));

  next();
}

/**
 * Handle native AVAX payment
 */
async function handleNativePayment(
  req: Request,
  res: Response,
  next: NextFunction,
  paymentData: any,
  _options: X402Options
) {
  const { payload } = paymentData;
  const { txHash, from } = payload;

  const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC);

  const tx = await provider.getTransaction(txHash);
  if (!tx) throw new Error('Transaction not found');

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) throw new Error('Transaction failed');

  if (tx.to?.toLowerCase() !== MERCHANT_ADDRESS.toLowerCase()) {
    throw new Error(`Invalid recipient: ${tx.to}`);
  }

  console.log(`[x402] ✓ Native payment verified: ${txHash}`);

  (req as any).x402 = {
    settled: true,
    payer: from,
    amount: ethers.formatEther(tx.value),
    currency: 'AVAX',
    network: 'avalanche',
    txHash,
  };

  res.setHeader('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify({
    success: true,
    txHash,
    network: 'avalanche',
  })).toString('base64'));

  next();
}

export default x402Middleware;
