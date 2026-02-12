"use client";
import React, { useEffect, useState, useRef } from "react";
import { Platform, View } from "react-native";

// Project IDs
const REOWN_PROJECT_ID = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID || process.env.REOWN_PROJECT_ID || "20ebf23c3bb262ce86b1746e9fffd567";
const THIRDWEB_CLIENT_ID = "f249aca5503deb7497b3fc37d990e44d";

// App metadata - following Reown docs exactly
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

// ============= WEB INITIALIZATION =============
let wagmiConfig: any = null;
let WagmiProviderWeb: any = null;
let QueryClientProviderWeb: any = null;
let queryClientWeb: any = null;
let isWebReady = false;

if (Platform.OS === "web") {
  try {
    const { QueryClient, QueryClientProvider: QCP } = require("@tanstack/react-query");
    const { createAppKit } = require("@reown/appkit/react");
    const { WagmiProvider: WP } = require("wagmi");
    const { avalanche, arbitrum, mainnet, polygon, base } = require("@reown/appkit/networks");
    const { WagmiAdapter } = require("@reown/appkit-adapter-wagmi");

    WagmiProviderWeb = WP;
    QueryClientProviderWeb = QCP;

    const networks = [avalanche, arbitrum, mainnet, polygon, base];

    const wagmiAdapter = new WagmiAdapter({
      projectId: REOWN_PROJECT_ID,
      networks
    });

    queryClientWeb = new QueryClient();
    wagmiConfig = wagmiAdapter.wagmiConfig;

    if (typeof window !== "undefined") {
      createAppKit({
        adapters: [wagmiAdapter],
        networks,
        defaultNetwork: avalanche,
        projectId: REOWN_PROJECT_ID,
        metadata,
        features: {
          analytics: true,
          email: false,
          socials: false,
          emailShowWallets: true,
          swaps: false,
          onramp: false,
          send: false,
          receive: false,
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
    isWebReady = true;
  } catch (e) {
    console.warn("[Web3] Web initialization warning:", e);
  }
}

// ============= NATIVE (Android/iOS) - LAZY INITIALIZATION =============
let appKitNative: any = null;
let wagmiAdapterNative: any = null;
let AppKitNative: any = null;
let AppKitProviderNative: any = null;
let WagmiProviderNative: any = null;
let QueryClientProviderNative: any = null;
let queryClientNative: any = null;
let isNativeReady = false;
let nativeInitPromise: Promise<boolean> | null = null;

/**
 * Storage adapter following Reown's Storage interface exactly:
 * https://docs.reown.com/appkit/react-native/core/installation#2-configure-storage
 */
function createStorageAdapter(AsyncStorage: any) {
  return {
    async getKeys(): Promise<string[]> {
      try {
        const keys = await AsyncStorage.getAllKeys();
        return keys || [];
      } catch (e) {
        console.error("[Storage] getKeys error:", e);
        return [];
      }
    },

    async getEntries<T = any>(): Promise<[string, T][]> {
      try {
        const keys = await this.getKeys();
        if (!keys || keys.length === 0) return [];

        const pairs = await AsyncStorage.multiGet(keys);
        if (!pairs) return [];

        return pairs
          .map(([key, value]: [string, string | null]) => {
            if (value === null) return null;
            try {
              return [key, JSON.parse(value)] as [string, T];
            } catch {
              return [key, value] as [string, T];
            }
          })
          .filter(Boolean) as [string, T][];
      } catch (e) {
        console.error("[Storage] getEntries error:", e);
        return [];
      }
    },

    async getItem<T = any>(key: string): Promise<T | undefined> {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value === null || value === undefined) {
          return undefined;
        }
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      } catch (e) {
        console.error("[Storage] getItem error:", key, e);
        return undefined;
      }
    },

    async setItem<T = any>(key: string, value: T): Promise<void> {
      try {
        const stringValue = typeof value === "string" ? value : JSON.stringify(value);
        await AsyncStorage.setItem(key, stringValue);
      } catch (e) {
        console.error("[Storage] setItem error:", key, e);
      }
    },

    async removeItem(key: string): Promise<void> {
      try {
        await AsyncStorage.removeItem(key);
      } catch (e) {
        console.error("[Storage] removeItem error:", key, e);
      }
    },
  };
}

// Initialize native AppKit following Reown docs exactly
async function initializeNativeAppKit(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (isNativeReady) return true;
  if (nativeInitPromise) return nativeInitPromise;

  nativeInitPromise = (async () => {
    try {
      console.log("[Web3] Initializing AppKit for native...");

      // Import AsyncStorage
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;

      // Clear any corrupted WalletConnect cache
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const wcKeys = allKeys.filter((key: string) => key.startsWith("wc@"));
        if (wcKeys.length > 0) {
          console.log("[Web3] Clearing", wcKeys.length, "WC cache keys...");
          await AsyncStorage.multiRemove(wcKeys);
        }
      } catch (e) {
        console.warn("[Web3] Cache clear warning:", e);
      }

      // Import packages following Reown docs
      const appKitRN = require("@reown/appkit-react-native");
      const { WagmiAdapter } = require("@reown/appkit-wagmi-react-native");
      const { WagmiProvider: WP } = require("wagmi");
      const { QueryClient, QueryClientProvider: QCP } = require("@tanstack/react-query");
      const viemChains = require("viem/chains");

      WagmiProviderNative = WP;
      QueryClientProviderNative = QCP;

      // Use viem/chains as documented
      const networks = [
        viemChains.avalanche,
        viemChains.mainnet,
        viemChains.polygon,
        viemChains.arbitrum,
        viemChains.base
      ];

      // Create storage adapter following the Storage interface
      const storage = createStorageAdapter(AsyncStorage);

      // Create wagmi adapter
      console.log("[Web3] Creating WagmiAdapter...");
      wagmiAdapterNative = new WagmiAdapter({
        projectId: REOWN_PROJECT_ID,
        networks,
      });

      // Create query client
      queryClientNative = new QueryClient();

      // Create AppKit instance following docs exactly
      console.log("[Web3] Creating AppKit instance...");
      appKitNative = appKitRN.createAppKit({
        projectId: REOWN_PROJECT_ID,
        adapters: [wagmiAdapterNative],
        networks,
        defaultNetwork: viemChains.avalanche,
        metadata,
        storage, // Pass the proper storage adapter
        features: {
          analytics: true,
          email: false,
          socials: false,
          swaps: false,
          onramp: false,
          send: false,
          receive: false,
        },
      });

      // Subscribe to connection events for debugging
      if (appKitNative.subscribeAccount) {
        appKitNative.subscribeAccount((account: any) => {
          console.log("[Web3] 🔔 Account subscription update:", account);
        });
      }
      if (appKitNative.subscribeProvider) {
        appKitNative.subscribeProvider((provider: any) => {
          console.log("[Web3] 🔔 Provider subscription update:", !!provider);
        });
      }

      // Store components
      AppKitNative = appKitRN.AppKit;
      AppKitProviderNative = appKitRN.AppKitProvider;

      isNativeReady = true;
      console.log("[Web3] ✅ Native AppKit initialized successfully!");
      return true;

    } catch (e: any) {
      console.error("[Web3] ❌ Native initialization error:", e?.message, e?.stack);
      return false;
    }
  })();

  return nativeInitPromise;
}

// Export for use in other components
const isWagmiReady = Platform.OS === "web" ? isWebReady : false;
export { wagmiConfig, REOWN_PROJECT_ID, THIRDWEB_CLIENT_ID, isWagmiReady };

// Export native AppKit instance for use in AuthContext
export { appKitNative, isNativeReady };

// Export the init function for lazy initialization
export { initializeNativeAppKit };

interface Web3ProviderProps {
  children: React.ReactNode;
}

// Context to signal when AppKit is ready
const AppKitReadyContext = React.createContext(false);
export const useAppKitReady = () => React.useContext(AppKitReadyContext);

export function Web3Provider({ children }: Web3ProviderProps) {
  const [nativeInitialized, setNativeInitialized] = useState(Platform.OS === "web");
  const initStarted = useRef(false);

  // Initialize native AppKit on mount
  useEffect(() => {
    if (Platform.OS === "web" || initStarted.current) return;
    initStarted.current = true;

    initializeNativeAppKit().then(success => {
      console.log("[Web3] Native init complete, success:", success);
      setNativeInitialized(true);
    });
  }, []);

  // ============= WEB PROVIDER =============
  if (Platform.OS === "web") {
    if (!WagmiProviderWeb || !QueryClientProviderWeb || !wagmiConfig || !queryClientWeb) {
      console.log("[Web3] Web providers not ready");
      return (
        <AppKitReadyContext.Provider value={false}>
          {children}
        </AppKitReadyContext.Provider>
      );
    }

    return (
      <AppKitReadyContext.Provider value={true}>
        <WagmiProviderWeb config={wagmiConfig}>
          <QueryClientProviderWeb client={queryClientWeb}>
            {children}
          </QueryClientProviderWeb>
        </WagmiProviderWeb>
      </AppKitReadyContext.Provider>
    );
  }

  // ============= NATIVE PROVIDER (Android/iOS) =============
  // Wait for initialization to complete
  if (!nativeInitialized) {
    console.log("[Web3] Waiting for native initialization...");
    return (
      <AppKitReadyContext.Provider value={false}>
        {children}
      </AppKitReadyContext.Provider>
    );
  }

  if (!isNativeReady || !WagmiProviderNative || !AppKitProviderNative || !QueryClientProviderNative) {
    console.log("[Web3] ⚠️ Native providers not ready after init");
    return (
      <AppKitReadyContext.Provider value={false}>
        {children}
      </AppKitReadyContext.Provider>
    );
  }

  console.log("[Web3] ✅ Rendering full native provider stack!");

  // Following Reown docs: AppKit must be wrapped in absolute positioned View on Android
  // https://docs.reown.com/appkit/react-native/core/installation#4-render-appkit-ui
  return (
    <AppKitReadyContext.Provider value={true}>
      <WagmiProviderNative config={wagmiAdapterNative.wagmiConfig}>
        <QueryClientProviderNative client={queryClientNative}>
          <AppKitProviderNative instance={appKitNative}>
            {children}
            {/* AppKit modal component - rendered at the end so it appears on top */}
            <AppKitNative />
          </AppKitProviderNative>
        </QueryClientProviderNative>
      </WagmiProviderNative>
    </AppKitReadyContext.Provider>
  );
}

export default Web3Provider;
