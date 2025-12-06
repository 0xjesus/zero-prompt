import { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { prisma } from '../prisma';

// Cache AVAX price for 60 seconds
let avaxPriceCache: { price: number; timestamp: number } | null = null;
const AVAX_PRICE_CACHE_TTL = 60000;

async function getAvaxPrice(): Promise<number> {
  if (avaxPriceCache && Date.now() - avaxPriceCache.timestamp < AVAX_PRICE_CACHE_TTL) {
    return avaxPriceCache.price;
  }
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd');
    const data = await response.json();
    const price = data['avalanche-2']?.usd || 25; // Default to $25 if API fails
    avaxPriceCache = { price, timestamp: Date.now() };
    return price;
  } catch {
    return avaxPriceCache?.price || 25;
  }
}

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
      const avaxPrice = await getAvaxPrice();
      const priceInAvax = (parseFloat(options.price) / avaxPrice * 1.05).toFixed(4); // 5% buffer for price fluctuation

      return res.status(402).json({
        x402Version: 2,
        accepts: [
          {
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
          },
          {
            scheme: "x402-native",
            network: "avalanche",
            chainId: AVALANCHE_CHAIN_ID,
            tokenSymbol: "AVAX",
            price: priceInAvax,
            priceUSD: options.price,
            resource: options.resourceId,
            description: options.description,
            payTo: MERCHANT_ADDRESS,
            maxTimeoutSeconds: 600,
          }
        ],
        error: "Payment required",
        hint: `Pay $${options.price} in USDC (gas sponsored) or ${priceInAvax} AVAX`,
      });
    }

    // ----------------------------------------------------------------
    // VERIFY AND EXECUTE PAYMENT
    // ----------------------------------------------------------------
    try {
      const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
      const paymentData = JSON.parse(decoded);

      const paymentType = paymentData.scheme === 'x402-eip3009' ? '💵 USDC' : '🔺 AVAX';
      console.log(`[x402] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[x402] ${paymentType} Payment received for ${options.resourceId}`);
      console.log(`[x402] Price: $${options.price} USD`);

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

      // Determine error type for better UX
      const isInsufficientFunds = error.message.includes('INSUFFICIENT_USDC');
      const errorCode = isInsufficientFunds ? 'INSUFFICIENT_FUNDS' : 'PAYMENT_FAILED';
      const userMessage = isInsufficientFunds
        ? error.message.replace('INSUFFICIENT_USDC: ', '')
        : error.message;
      const hint = isInsufficientFunds
        ? `You need $${options.price} USDC on Avalanche. Get USDC at a DEX or bridge from another chain.`
        : "Please try again";

      return res.status(402).json({
        x402Version: 2,
        error: userMessage,
        errorCode,
        accepts: [{
          scheme: "x402-eip3009",
          network: "avalanche",
          chainId: AVALANCHE_CHAIN_ID,
          token: AVALANCHE_USDC,
          price: options.price,
          payTo: MERCHANT_ADDRESS,
          gasSponsored: true,
        }],
        hint,
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

  console.log(`[x402] 💵 USDC Transfer: ${from.slice(0,8)}... → Merchant`);
  console.log(`[x402] 💵 Amount: ${ethers.formatUnits(value, 6)} USDC`);

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
    const currentBalance = ethers.formatUnits(balance, 6);
    const requiredAmount = ethers.formatUnits(value, 6);
    const shortfall = (parseFloat(requiredAmount) - parseFloat(currentBalance)).toFixed(2);
    throw new Error(`INSUFFICIENT_USDC: You have $${currentBalance} USDC but need $${requiredAmount} USDC. Please add at least $${shortfall} USDC to your wallet.`);
  }

  // Split signature
  const sig = ethers.Signature.from(signature);

  console.log(`[x402] 💵 Executing gasless USDC transfer (server pays gas)...`);

  // Execute (server pays gas!)
  const tx = await usdcContract.transferWithAuthorization(
    from, to, value, validAfter, validBefore, nonce,
    sig.v, sig.r, sig.s
  );

  console.log(`[x402] Tx sent: ${tx.hash}`);

  const receipt = await tx.wait(1);
  if (receipt.status !== 1) throw new Error('Transaction failed');

  console.log(`[x402] 💵 ✅ USDC Payment confirmed! Block: ${receipt.blockNumber}`);

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
    console.log(`[x402] 💵 ✅ USDC Payment logged to DB`);
    console.log(`[x402] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
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
 * Wait for transaction with retries (Avalanche can take a moment to index)
 */
async function waitForTransaction(provider: ethers.JsonRpcProvider, txHash: string, maxRetries = 10): Promise<ethers.TransactionResponse> {
  for (let i = 0; i < maxRetries; i++) {
    const tx = await provider.getTransaction(txHash);
    if (tx) return tx;
    console.log(`[x402] 🔺 Waiting for tx to be indexed... (attempt ${i + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between retries
  }
  throw new Error('Transaction not found after waiting. Please try again.');
}

/**
 * Handle native AVAX payment
 */
async function handleNativePayment(
  req: Request,
  res: Response,
  next: NextFunction,
  paymentData: any,
  options: X402Options
) {
  const { payload } = paymentData;
  const { txHash, from } = payload;

  const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC);

  // Wait for transaction to be indexed (with retries)
  const tx = await waitForTransaction(provider, txHash);

  // Wait for confirmation
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error('Transaction failed');

  if (tx.to?.toLowerCase() !== MERCHANT_ADDRESS.toLowerCase()) {
    throw new Error(`Invalid recipient: ${tx.to}`);
  }

  // Validate AVAX amount
  const avaxPrice = await getAvaxPrice();
  const requiredUSD = parseFloat(options.price);
  const paidAvax = parseFloat(ethers.formatEther(tx.value));
  const paidUSD = paidAvax * avaxPrice;

  // Allow 10% slippage for price fluctuations
  if (paidUSD < requiredUSD * 0.9) {
    throw new Error(`INSUFFICIENT_AVAX: Paid $${paidUSD.toFixed(2)} but need $${requiredUSD}. Send more AVAX.`);
  }

  console.log(`[x402] 🔺 AVAX Transfer: ${from.slice(0,8)}... → Merchant`);
  console.log(`[x402] 🔺 Amount: ${paidAvax.toFixed(4)} AVAX (~$${paidUSD.toFixed(2)} USD)`);
  console.log(`[x402] 🔺 ✅ AVAX Payment verified! Tx: ${txHash.slice(0,16)}...`);

  // Log payment to database
  const modelUsed = req.body?.model || null;
  try {
    await prisma.x402Payment.create({
      data: {
        txHash: txHash,
        fromAddress: from,
        toAddress: MERCHANT_ADDRESS,
        amountUSDC: paidUSD.toFixed(2), // Store USD equivalent
        priceUSD: options.price,
        endpoint: options.resourceId,
        model: modelUsed,
        status: 'success',
      },
    });
    console.log(`[x402] 🔺 ✅ AVAX Payment logged to DB`);
    console.log(`[x402] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  } catch (dbError: any) {
    console.error(`[x402] DB log error:`, dbError.message);
  }

  (req as any).x402 = {
    settled: true,
    payer: from,
    amount: paidAvax.toString(),
    amountUSD: paidUSD.toFixed(2),
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
