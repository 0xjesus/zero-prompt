// ================================================================
// ZeroPrompt Constants - Avalanche Network
// ================================================================

// Avalanche C-Chain configuration
export const AVALANCHE_CONFIG = {
  chainId: 43114,
  name: "Avalanche",
  symbol: "AVAX",
  rpc: "https://api.avax.network/ext/bc/C/rpc",
  usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" as `0x${string}`,
  usdcDecimals: 6,
} as const;

// ZeroPromptVault contract address on Avalanche
export const VAULT_ADDRESS = "0x773c9849F15Ac7484232767536Fe5495B5E231e9";

// Merchant address for x402 payments
export const MERCHANT_ADDRESS = process.env.EXPO_PUBLIC_X402_MERCHANT_ADDRESS || "0xA43e4Df85CBEF2D86669c90b581E5FA7e9B06Baa";
