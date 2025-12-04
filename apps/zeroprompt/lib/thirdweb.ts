import { createThirdwebClient } from "thirdweb";
import { avalanche, base, arbitrum, polygon } from "thirdweb/chains";

// Initialize thirdweb client
// IMPORTANT: Add localhost to allowed domains in thirdweb dashboard:
// https://thirdweb.com/dashboard/settings/api-keys
//
// For development without a configured client ID, you can use secretKey instead
// but that requires server-side usage only.
const clientId = process.env.EXPO_PUBLIC_THIRDWEB_CLIENT_ID;

export const thirdwebClient = createThirdwebClient(
  clientId
    ? { clientId }
    : {
        // Fallback for development - limited functionality
        clientId: "e0c0097f71fa8a0bd7cbfd6968dde8d9",
      }
);

// Supported chains for gas sponsorship
export const SPONSORED_CHAINS = {
  avalanche: {
    chain: avalanche,
    chainId: 43114,
    name: "Avalanche",
    symbol: "AVAX",
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    usdcDecimals: 6,
  },
  base: {
    chain: base,
    chainId: 8453,
    name: "Base",
    symbol: "ETH",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
  },
  arbitrum: {
    chain: arbitrum,
    chainId: 42161,
    name: "Arbitrum",
    symbol: "ETH",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdcDecimals: 6,
  },
  polygon: {
    chain: polygon,
    chainId: 137,
    name: "Polygon",
    symbol: "POL",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    usdcDecimals: 6,
  },
} as const;

// ZeroPromptVault contract address on Avalanche
export const VAULT_ADDRESS = "0x773c9849F15Ac7484232767536Fe5495B5E231e9";

// Merchant address for x402 payments
export const MERCHANT_ADDRESS = process.env.EXPO_PUBLIC_X402_MERCHANT_ADDRESS || "0x209F0baCA0c23edc57881B26B68FC4148123B039";

// Default chain for deposits
export const DEFAULT_CHAIN = SPONSORED_CHAINS.avalanche;
