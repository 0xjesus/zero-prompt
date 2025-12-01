"use client";
import React from "react";
import { Platform } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { WagmiProvider, type Config } from "wagmi";
import { avalanche, arbitrum, mainnet, polygon, base } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

// Reown Project ID from environment
const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID || process.env.REOWN_PROJECT_ID || "20ebf23c3bb262ce86b1746e9fffd567";

// App metadata
const metadata = {
  name: "ZeroPrompt",
  description: "AI Chat with Crypto Payments",
  url: "https://zeroprompt.ai",
  icons: ["https://zeroprompt.ai/icon.png"]
};

// Supported networks - Avalanche is primary
const networks = [avalanche, arbitrum, mainnet, polygon, base] as const;

// Create wagmi adapter with coinbase explicitly disabled
const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks
});

// Create query client
const queryClient = new QueryClient();

// Initialize AppKit only on web - wrapped in try-catch to suppress Coinbase SDK loading errors
// The Coinbase SDK error is a known issue with Metro bundler and doesn't affect functionality
if (Platform.OS === "web" && typeof window !== "undefined") {
  try {
    createAppKit({
      adapters: [wagmiAdapter],
      networks,
      defaultNetwork: avalanche,
      projectId,
      metadata,
      features: {
        analytics: true,
        email: false,
        socials: false,
        emailShowWallets: true,
      },
      enableCoinbase: false,
      coinbasePreference: "eoaOnly",
      themeMode: "dark",
      themeVariables: {
        "--w3m-accent": "#8B5CF6",
        "--w3m-border-radius-master": "2px"
      }
    });
  } catch (e) {
    // Silently ignore AppKit initialization errors (usually Coinbase SDK loading issues)
    console.warn("AppKit initialization warning:", e);
  }
}

// Export wagmi config for use in components
export const wagmiConfig = wagmiAdapter.wagmiConfig as Config;

interface Web3ProviderProps {
  children: React.ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  // Skip wagmi on non-web platforms for now
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default Web3Provider;
