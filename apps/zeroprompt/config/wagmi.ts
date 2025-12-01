import { Platform } from "react-native";

// Chain configurations for ZeroPrompt
export const SUPPORTED_CHAINS = {
  avalanche: {
    id: 43114,
    name: "Avalanche",
    network: "avalanche",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://api.avax.network/ext/bc/C/rpc"] },
      public: { http: ["https://api.avax.network/ext/bc/C/rpc"] }
    },
    blockExplorers: {
      default: { name: "Snowtrace", url: "https://snowtrace.io" }
    }
  },
  avalancheFuji: {
    id: 43113,
    name: "Avalanche Fuji",
    network: "avalanche-fuji",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://api.avax-test.network/ext/bc/C/rpc"] },
      public: { http: ["https://api.avax-test.network/ext/bc/C/rpc"] }
    },
    blockExplorers: {
      default: { name: "Snowtrace", url: "https://testnet.snowtrace.io" }
    },
    testnet: true
  },
  ethereum: {
    id: 1,
    name: "Ethereum",
    network: "ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://eth.llamarpc.com"] },
      public: { http: ["https://eth.llamarpc.com"] }
    },
    blockExplorers: {
      default: { name: "Etherscan", url: "https://etherscan.io" }
    }
  },
  arbitrum: {
    id: 42161,
    name: "Arbitrum One",
    network: "arbitrum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://arb1.arbitrum.io/rpc"] },
      public: { http: ["https://arb1.arbitrum.io/rpc"] }
    },
    blockExplorers: {
      default: { name: "Arbiscan", url: "https://arbiscan.io" }
    }
  },
  polygon: {
    id: 137,
    name: "Polygon",
    network: "polygon",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://polygon-rpc.com"] },
      public: { http: ["https://polygon-rpc.com"] }
    },
    blockExplorers: {
      default: { name: "PolygonScan", url: "https://polygonscan.com" }
    }
  },
  base: {
    id: 8453,
    name: "Base",
    network: "base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://mainnet.base.org"] },
      public: { http: ["https://mainnet.base.org"] }
    },
    blockExplorers: {
      default: { name: "BaseScan", url: "https://basescan.org" }
    }
  }
} as const;

// Default network (Avalanche mainnet)
export const DEFAULT_CHAIN_ID = 43114;

// Get chain by ID
export const getChainById = (chainId: number) => {
  return Object.values(SUPPORTED_CHAINS).find((c) => c.id === chainId);
};

// Get network ID by chain ID
export const getNetworkIdByChainId = (chainId: number): string => {
  const mapping: Record<number, string> = {
    43114: "avalanche",
    43113: "avalancheFuji",
    1: "ethereum",
    42161: "arbitrum",
    137: "polygon",
    8453: "base"
  };
  return mapping[chainId] || "avalanche";
};

// Check if running on web
export const isWeb = Platform.OS === "web";
