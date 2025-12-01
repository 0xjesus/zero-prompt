import { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';

// ----------------------------------------------------------------
// CONFIGURATION - AVALANCHE MAINNET (ALWAYS)
// ----------------------------------------------------------------
const RPC_URL = process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc";
const CHAIN_ID = 43114;
const NETWORK_NAME = "avalanche";

// IMPORTANT: This must match the address in the frontend (protocol.tsx)
const MERCHANT_ADDRESS = process.env.X402_MERCHANT_ADDRESS || "0x209F0baCA0c23edc57881B26B68FC4148123B039";

// Provider for verifying on-chain transactions
const provider = new ethers.JsonRpcProvider(RPC_URL);

console.log(`[x402] Initialized on ${NETWORK_NAME} MAINNET (Chain ID: ${CHAIN_ID})`);
console.log(`[x402] Merchant Address: ${MERCHANT_ADDRESS}`);

// In-memory cache of used Transaction Hashes to prevent replay attacks
// In production, use Redis or a database with unique constraint
const usedTxHashes = new Set<string>();

interface X402Options {
  price: string; // Amount in WEI (e.g. "10000000000000000" for 0.01 AVAX)
  resourceId: string;
  description: string;
}

/**
 * x402 Middleware - AVAX NATIVE EDITION (MAINNET)
 * Verifies that a real AVAX transaction has been sent to us.
 */
export const x402 = (options: X402Options) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers['x-payment'];

    // ----------------------------------------------------------------
    // CASE 1: NO PAYMENT PROVIDED -> RETURN 402 CHALLENGE
    // ----------------------------------------------------------------
    if (!paymentHeader || typeof paymentHeader !== 'string') {
      return res.status(402).json({
        x402Version: 1,
        accepts: [
          {
            scheme: "native-tx",
            network: NETWORK_NAME,
            chainId: CHAIN_ID,
            maxAmountRequired: options.price, // In Wei
            resource: options.resourceId,
            description: options.description,
            payTo: MERCHANT_ADDRESS,
            asset: "AVAX",
            maxTimeoutSeconds: 600
          }
        ],
        error: "X-PAYMENT header required with { txHash: '0x...' }",
        hint: `Send AVAX to ${MERCHANT_ADDRESS} on ${NETWORK_NAME} (Chain ID: ${CHAIN_ID})`
      });
    }

    // ----------------------------------------------------------------
    // CASE 2: VERIFY PAYMENT TRANSACTION
    // ----------------------------------------------------------------
    try {
      // 1. Decode Header
      const decodedJson = Buffer.from(paymentHeader, 'base64').toString('utf-8');
      const paymentData = JSON.parse(decodedJson);

      const txHash = paymentData.txHash;

      if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
        throw new Error("Invalid transaction hash format");
      }

      // 2. Replay Protection (Cache Check)
      if (usedTxHashes.has(txHash)) {
        throw new Error("Transaction already used for payment");
      }

      // 3. Verify On-Chain
      console.log(`[x402] Verifying Hash: ${txHash} on ${NETWORK_NAME} (Chain ID ${CHAIN_ID})`);
      const tx = await provider.getTransaction(txHash);

      if (!tx) {
         console.log(`[x402] Tx not found: ${txHash}`);
         throw new Error(`Transaction not found on ${NETWORK_NAME}. Make sure you're on the correct network (Chain ID: ${CHAIN_ID})`);
      }
      console.log(`[x402] Tx found. From: ${tx.from} To: ${tx.to} Value: ${tx.value}`);
      
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
          console.log(`[x402] Tx pending (no receipt)`);
          throw new Error("Transaction pending, please wait for confirmation");
      }
      if (receipt.status !== 1) {
          console.log(`[x402] Tx failed status: ${receipt.status}`);
          throw new Error("Transaction failed on-chain");
      }

      // 4. Verify Transaction Details
      if (tx.to?.toLowerCase() !== MERCHANT_ADDRESS.toLowerCase()) {
          console.log(`[x402] Invalid recipient: ${tx.to} vs ${MERCHANT_ADDRESS}`);
          throw new Error(`Invalid recipient. Sent to ${tx.to}, expected ${MERCHANT_ADDRESS}`);
      }

      const sentValue = tx.value; // BigInt
      const requiredValue = BigInt(options.price);

      if (sentValue < requiredValue) {
          throw new Error(`Insufficient amount. Sent ${ethers.formatEther(sentValue)} AVAX, required ${ethers.formatEther(requiredValue)} AVAX`);
      }

      // 5. Mark Hash as Used
      usedTxHashes.add(txHash);

      // Attach user info to request
      (req as any).x402 = {
        payer: tx.from,
        amount: sentValue.toString(),
        proof: txHash
      };

      // Return Success Header
      const responseHeader = {
        success: true,
        transaction: txHash,
        network: "avalanche",
        payer: tx.from,
        errorReason: null
      };
      
      res.setHeader('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify(responseHeader)).toString('base64'));

      next();

    } catch (error: any) {
      console.error("x402 Verification Error:", error.message);
      return res.status(402).json({
        error: `Payment verification failed: ${error.message}`,
        accepts: [
            {
              scheme: "native-tx",
              network: NETWORK_NAME,
              chainId: CHAIN_ID,
              maxAmountRequired: options.price,
              payTo: MERCHANT_ADDRESS,
              asset: "AVAX"
            }
        ],
        hint: `Ensure transaction is on ${NETWORK_NAME} (Chain ID: ${CHAIN_ID}) and sent to ${MERCHANT_ADDRESS}`
      });
    }
  };
};
