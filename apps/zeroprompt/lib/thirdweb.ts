/**
 * Thirdweb Configuration for ZeroPrompt
 *
 * This module configures Thirdweb SDK for web3-lite users who want to:
 * - Purchase USDC with credit card
 * - Use in-app wallet without existing crypto
 * - Bridge tokens from other chains
 */

import { createThirdwebClient } from "thirdweb";
import { avalanche } from "thirdweb/chains";

// Thirdweb Client ID - Get one at https://thirdweb.com/dashboard
// Store in .env as EXPO_PUBLIC_THIRDWEB_CLIENT_ID
const THIRDWEB_CLIENT_ID = process.env.EXPO_PUBLIC_THIRDWEB_CLIENT_ID || "";

// Create the Thirdweb client
export const thirdwebClient = THIRDWEB_CLIENT_ID
  ? createThirdwebClient({
      clientId: THIRDWEB_CLIENT_ID,
    })
  : null;

// Avalanche USDC contract address
export const AVALANCHE_USDC = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";

// Default chain for purchases
export const DEFAULT_CHAIN = avalanche;

// Merchant wallet address for receiving USDC
export const MERCHANT_ADDRESS = process.env.EXPO_PUBLIC_X402_MERCHANT_ADDRESS || "0x209F0baCA0c23edc57881B26B68FC4148123B039";

// Supported tokens for payment
export const SUPPORTED_TOKENS = {
  [avalanche.id]: [
    {
      address: AVALANCHE_USDC,
      name: "USD Coin",
      symbol: "USDC",
    },
  ],
};

// Model Reputation Registry Contract (deployed on Avalanche)
export const MODEL_REPUTATION_REGISTRY_ADDRESS = process.env.EXPO_PUBLIC_MODEL_REPUTATION_REGISTRY || "";

// Check if Thirdweb is configured
export const isThirdwebConfigured = (): boolean => {
  return !!THIRDWEB_CLIENT_ID && !!thirdwebClient;
};
