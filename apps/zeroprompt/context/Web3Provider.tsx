"use client";
import React, { useEffect, useState } from "react";
import { Platform, Linking } from "react-native";

// Only import web3 dependencies on web platform
let wagmiConfig: any = null;
let WagmiProvider: any = null;
let QueryClientProvider: any = null;
let queryClient: any = null;
let AppKitRN: any = null;
let AppKitButtonRN: any = null;

// Project ID for WalletConnect
const PROJECT_ID = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID || process.env.REOWN_PROJECT_ID || "20ebf23c3bb262ce86b1746e9fffd567";

// App metadata
const metadata = {
  name: "ZeroPrompt",
  description: "AI Chat with Crypto Payments",
  url: "https://zeroprompt.app",
  icons: ["https://zeroprompt.app/icon.png"],
  redirect: {
    native: "zeroprompt://",
    universal: "https://zeroprompt.app"
  }
};

// Initialize Web3 for WEB
if (Platform.OS === "web") {
  try {
    const { QueryClient, QueryClientProvider: QCP } = require("@tanstack/react-query");
    const { createAppKit } = require("@reown/appkit/react");
    const { WagmiProvider: WP } = require("wagmi");
    const { avalanche, arbitrum, mainnet, polygon, base } = require("@reown/appkit/networks");
    const { WagmiAdapter } = require("@reown/appkit-adapter-wagmi");

    WagmiProvider = WP;
    QueryClientProvider = QCP;

    // Supported networks - Avalanche is primary
    const networks = [avalanche, arbitrum, mainnet, polygon, base];

    // Create wagmi adapter with coinbase explicitly disabled
    const wagmiAdapter = new WagmiAdapter({
      projectId: PROJECT_ID,
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
        projectId: PROJECT_ID,
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

// Initialize Web3 for REACT NATIVE (Android/iOS)
if (Platform.OS === "android" || Platform.OS === "ios") {
  try {
    // Import React Native specific modules
    require("@walletconnect/react-native-compat");

    const appKitRN = require("@reown/appkit-wagmi-react-native");
    const { QueryClient, QueryClientProvider: QCP } = require("@tanstack/react-query");
    const { WagmiProvider: WP, createConfig, http } = require("wagmi");
    const { avalanche } = require("wagmi/chains");
    const { walletConnect } = require("wagmi/connectors");

    WagmiProvider = WP;
    QueryClientProvider = QCP;
    AppKitRN = appKitRN.createAppKit;
    AppKitButtonRN = appKitRN.AppKitButton;

    // Create wagmi config for React Native
    wagmiConfig = createConfig({
      chains: [avalanche],
      connectors: [
        walletConnect({
          projectId: PROJECT_ID,
          metadata,
          showQrModal: false, // We'll use AppKit modal
        }),
      ],
      transports: {
        [avalanche.id]: http("https://api.avax.network/ext/bc/C/rpc"),
      },
    });

    // Create query client
    queryClient = new QueryClient();

    // Initialize AppKit for React Native
    if (AppKitRN) {
      AppKitRN({
        projectId: PROJECT_ID,
        wagmiConfig,
        metadata,
        defaultChain: avalanche,
        enableAnalytics: false,
      });
    }
  } catch (e) {
    console.warn("React Native AppKit initialization warning:", e);
  }
}

// Export wagmi config for use in components (will be null if init failed)
export { wagmiConfig, AppKitButtonRN, PROJECT_ID };

interface Web3ProviderProps {
  children: React.ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  // Skip if wagmi not initialized
  if (!WagmiProvider || !QueryClientProvider || !wagmiConfig || !queryClient) {
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
