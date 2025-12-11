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

// Merchant address for x402 payments (must match backend X402_MERCHANT_ADDRESS)
// IMPORTANT: Hardcoded to prevent env var issues on Android
export const MERCHANT_ADDRESS = "0x209F0baCA0c23edc57881B26B68FC4148123B039";
