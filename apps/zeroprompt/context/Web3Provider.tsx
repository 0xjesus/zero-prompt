"use client";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";

// Only import web3 dependencies on web platform
let wagmiConfig: any = null;
let WagmiProvider: any = null;
let QueryClientProvider: any = null;
let queryClient: any = null;

// Initialize Web3 only on web
if (Platform.OS === "web") {
  try {
    const { QueryClient, QueryClientProvider: QCP } = require("@tanstack/react-query");
    const { createAppKit } = require("@reown/appkit/react");
    const { WagmiProvider: WP } = require("wagmi");
    const { avalanche, arbitrum, mainnet, polygon, base } = require("@reown/appkit/networks");
    const { WagmiAdapter } = require("@reown/appkit-adapter-wagmi");

    WagmiProvider = WP;
    QueryClientProvider = QCP;

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
    const networks = [avalanche, arbitrum, mainnet, polygon, base];

    // Create wagmi adapter with coinbase explicitly disabled
    const wagmiAdapter = new WagmiAdapter({
      projectId,
      networks
    });

    // Create query client
    queryClient = new QueryClient();

    // Export wagmi config for use in components
    wagmiConfig = wagmiAdapter.wagmiConfig;

    // Initialize AppKit only on web
    if (typeof window !== "undefined") {
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
    }
  } catch (e) {
    // Silently ignore AppKit initialization errors
    console.warn("AppKit initialization warning:", e);
  }
}

// Export wagmi config for use in components (will be null on non-web)
export { wagmiConfig };

interface Web3ProviderProps {
  children: React.ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  // Skip wagmi on non-web platforms
  if (Platform.OS !== "web" || !WagmiProvider || !QueryClientProvider || !wagmiConfig || !queryClient) {
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
