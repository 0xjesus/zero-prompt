// Wagmi shims for React Native
// Re-export WagmiProvider from the actual wagmi package (needed for AppKit)
// Provides real implementations using AppKit hooks for native

import * as React from 'react';

// IMPORTANT: Import the real WagmiProvider from wagmi
// This works because metro's resolver runs on the import statement in THIS file,
// and this file is in node_modules-like location (shims/), so it won't be shimmed again
// Actually, we need to get it from the absolute path to avoid recursive shimming

// For WagmiProvider, we import the real one via require with full path resolution
// The metro config shimming only affects imports from user code, not from shims
const wagmiReal = require("wagmi");
export const WagmiProvider = wagmiReal.WagmiProvider;

// Real implementation using AppKit provider
// Import hooks at module level for use across all exported hooks
let appKitRN: any = null;
try {
  appKitRN = require("@reown/appkit-react-native");
} catch (e) {
  console.warn("[wagmi-native] AppKit React Native not available");
}

// Export REAL useAccount that uses AppKit's hook
export const useAccount = () => {
  if (appKitRN?.useAccount) {
    try {
      const account = appKitRN.useAccount();
      return {
        address: account?.address,
        isConnected: account?.isConnected || false,
        isConnecting: false,
        isDisconnected: !account?.isConnected,
        status: account?.isConnected ? 'connected' as const : 'disconnected' as const,
      };
    } catch (e) {
      // Hook called outside provider, return defaults
    }
  }
  return {
    address: undefined,
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
    status: 'disconnected' as const,
  };
};

// Helper to get provider hook
const useProviderHook = () => {
  if (appKitRN?.useProvider) {
    try {
      return appKitRN.useProvider();
    } catch (e) {
      // Hook called outside provider
    }
  }
  return { provider: null };
};

// Helper to get account hook (for internal use)
const useAccountHook = () => {
  if (appKitRN?.useAccount) {
    try {
      return appKitRN.useAccount();
    } catch (e) {
      // Hook called outside provider
    }
  }
  return { address: undefined, isConnected: false };
};

export const useSignTypedData = () => {
  const [data, setData] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<Error | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);

  const providerData = useProviderHook();
  const accountData = useAccountHook();
  const provider = providerData?.provider;
  const accountAddress = accountData?.address;

  const signTypedDataAsync = React.useCallback(async (params: {
    domain: any;
    types: any;
    primaryType: string;
    message: any;
  }) => {
    if (!provider) {
      throw new Error("Wallet provider not available. Please reconnect your wallet.");
    }

    let fromAddress = accountAddress;
    if (!fromAddress) {
      const accounts = await provider.request({ method: 'eth_accounts' });
      fromAddress = accounts?.[0];
    }

    if (!fromAddress) {
      throw new Error("No wallet address available");
    }

    setIsPending(true);
    setError(null);
    setIsError(false);
    setIsSuccess(false);

    try {
      // Helper to convert BigInt to string recursively
      const convertBigInts = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'bigint') return obj.toString();
        if (Array.isArray(obj)) return obj.map(convertBigInts);
        if (typeof obj === 'object') {
          const result: any = {};
          for (const key in obj) {
            result[key] = convertBigInts(obj[key]);
          }
          return result;
        }
        return obj;
      };

      // Build EIP-712 typed data structure with BigInts converted
      const typedData = convertBigInts({
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          ...params.types,
        },
        primaryType: params.primaryType,
        domain: params.domain,
        message: params.message,
      });

      console.log("[wagmi-native] signTypedDataAsync params:", JSON.stringify(typedData, null, 2));
      console.log("[wagmi-native] Requesting signature from wallet...");
      console.log("[wagmi-native] From address:", fromAddress);
      console.log("[wagmi-native] Provider available:", !!provider);

      // Try to open wallet app to prompt user (WalletConnect needs this)
      try {
        const { Linking } = require('react-native');
        // Try common wallet deep links
        Linking.openURL('wc:').catch(() => {
          Linking.openURL('metamask:').catch(() => {});
        });
      } catch (e) {
        console.log("[wagmi-native] Could not open wallet app:", e);
      }

      // Use eth_signTypedData_v4 for EIP-712 signing
      let signature: string;

      try {
        console.log("[wagmi-native] Trying eth_signTypedData_v4...");
        signature = await provider.request({
          method: 'eth_signTypedData_v4',
          params: [fromAddress, JSON.stringify(typedData)],
        });
      } catch (v4Error: any) {
        console.log("[wagmi-native] eth_signTypedData_v4 failed:", v4Error.message);
        console.log("[wagmi-native] Trying eth_signTypedData...");

        // Fallback to eth_signTypedData (v3)
        try {
          signature = await provider.request({
            method: 'eth_signTypedData',
            params: [fromAddress, typedData],
          });
        } catch (v3Error: any) {
          console.log("[wagmi-native] eth_signTypedData failed:", v3Error.message);
          throw v4Error; // Throw original error
        }
      }

      console.log("[wagmi-native] Signature received:", signature);
      setData(signature);
      setIsSuccess(true);
      setIsPending(false);
      return signature;
    } catch (err: any) {
      console.error("[wagmi-native] signTypedDataAsync error:", err);
      setError(err);
      setIsError(true);
      setIsPending(false);
      throw err;
    }
  }, [provider, accountAddress]);

  const signTypedData = React.useCallback((params: any) => {
    signTypedDataAsync(params).catch(() => {});
  }, [signTypedDataAsync]);

  const reset = React.useCallback(() => {
    setData(undefined);
    setError(null);
    setIsPending(false);
    setIsSuccess(false);
    setIsError(false);
  }, []);

  return {
    signTypedData,
    signTypedDataAsync,
    data,
    error,
    isError,
    isIdle: !isPending && !isSuccess && !isError,
    isLoading: isPending,
    isPending,
    isSuccess,
    reset,
    status: isPending ? 'pending' : isSuccess ? 'success' : isError ? 'error' : 'idle',
  };
};

export const useSendTransaction = () => {
  const [data, setData] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<Error | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);

  // Get provider and account from AppKit hooks (called at top level - follows hook rules)
  const providerData = useProviderHook();
  const accountData = useAccountHook();
  const provider = providerData?.provider;
  const accountAddress = accountData?.address;

  const sendTransactionAsync = React.useCallback(async (params: {
    to: string | `0x${string}`;
    value?: bigint;
    data?: string;
    chainId?: number;
  }) => {
    if (!provider) {
      throw new Error("Wallet provider not available. Please reconnect your wallet.");
    }

    // Validate and normalize the 'to' address
    let toAddress = params.to;
    if (!toAddress) {
      throw new Error("Invalid recipient: 'to' address is required");
    }

    // Convert to string if it's not already
    toAddress = String(toAddress).toLowerCase();

    // Validate it's a proper Ethereum address
    if (!toAddress.startsWith('0x') || toAddress.length !== 42) {
      console.error("[wagmi-native] Invalid 'to' address format:", toAddress);
      throw new Error(`Invalid recipient: address must be a valid Ethereum address (got: ${toAddress})`);
    }

    setIsPending(true);
    setError(null);
    setIsError(false);
    setIsSuccess(false);

    try {
      let fromAddress = accountAddress;

      if (!fromAddress) {
        // Try to get from provider
        const accounts = await provider.request({ method: 'eth_accounts' });
        fromAddress = accounts?.[0];
      }

      if (!fromAddress) {
        throw new Error("No wallet address available");
      }

      const txParams: any = {
        from: fromAddress,
        to: toAddress, // Use validated address
      };

      if (params.value) {
        // Ensure value is properly formatted as hex
        const valueHex = '0x' + params.value.toString(16);
        txParams.value = valueHex;
        console.log("[wagmi-native] Value:", params.value.toString(), "->", valueHex);
      }
      if (params.data) {
        txParams.data = params.data;
      }

      console.log("[wagmi-native] sendTransactionAsync params:", JSON.stringify(txParams, null, 2));

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      console.log("[wagmi-native] Transaction hash:", hash);
      setData(hash);
      setIsSuccess(true);
      setIsPending(false);
      return hash;
    } catch (err: any) {
      console.error("[wagmi-native] sendTransactionAsync error:", err);
      console.error("[wagmi-native] Error details:", err.message, err.code);
      setError(err);
      setIsError(true);
      setIsPending(false);
      throw err;
    }
  }, [provider, accountAddress]);

  const sendTransaction = React.useCallback((params: any) => {
    sendTransactionAsync(params).catch(() => {});
  }, [sendTransactionAsync]);

  const reset = React.useCallback(() => {
    setData(undefined);
    setError(null);
    setIsPending(false);
    setIsSuccess(false);
    setIsError(false);
  }, []);

  return {
    sendTransaction,
    sendTransactionAsync,
    data,
    error,
    isError,
    isIdle: !isPending && !isSuccess && !isError,
    isLoading: isPending,
    isPending,
    isSuccess,
    reset,
    status: isPending ? 'pending' : isSuccess ? 'success' : isError ? 'error' : 'idle',
  };
};

export const useWaitForTransactionReceipt = () => ({
  data: undefined,
  error: null,
  isError: false,
  isLoading: false,
  isPending: false,
  isSuccess: false,
  status: 'idle',
});

export const useSwitchChain = () => {
  const [error, setError] = React.useState<Error | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);

  const providerData = useProviderHook();
  const provider = providerData?.provider;

  const switchChainAsync = React.useCallback(async (params: { chainId: number }) => {
    if (!provider) {
      throw new Error("Wallet provider not available");
    }

    setIsPending(true);
    setError(null);
    setIsError(false);
    setIsSuccess(false);

    try {
      const chainIdHex = '0x' + params.chainId.toString(16);
      console.log("[wagmi-native] Switching to chain:", params.chainId, chainIdHex);

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
      } catch (switchError: any) {
        // Chain not added, try to add it (for Avalanche)
        if (switchError.code === 4902 && params.chainId === 43114) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainIdHex,
              chainName: 'Avalanche C-Chain',
              nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
              rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
              blockExplorerUrls: ['https://snowtrace.io/'],
            }],
          });
        } else {
          throw switchError;
        }
      }

      console.log("[wagmi-native] Chain switched successfully");
      setIsSuccess(true);
      setIsPending(false);
    } catch (err: any) {
      console.error("[wagmi-native] switchChainAsync error:", err);
      setError(err);
      setIsError(true);
      setIsPending(false);
      throw err;
    }
  }, [provider]);

  const switchChain = React.useCallback((params: any) => {
    switchChainAsync(params).catch(() => {});
  }, [switchChainAsync]);

  const reset = React.useCallback(() => {
    setError(null);
    setIsPending(false);
    setIsSuccess(false);
    setIsError(false);
  }, []);

  return {
    switchChain,
    switchChainAsync,
    chains: [{ id: 43114, name: 'Avalanche' }],
    error,
    isError,
    isIdle: !isPending && !isSuccess && !isError,
    isLoading: isPending,
    isPending,
    isSuccess,
    reset,
    status: isPending ? 'pending' : isSuccess ? 'success' : isError ? 'error' : 'idle',
  };
};

export const useChainId = () => 43114; // Avalanche

export const useWalletClient = () => ({
  data: undefined,
  error: null,
  isError: false,
  isLoading: false,
  isPending: false,
  isSuccess: false,
  status: 'idle',
});

export const useWriteContract = () => {
  const [data, setData] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<Error | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);

  const providerData = useProviderHook();
  const accountData = useAccountHook();
  const provider = providerData?.provider;
  const accountAddress = accountData?.address;

  const writeContractAsync = React.useCallback(async (params: {
    address: string;
    abi: any[];
    functionName: string;
    args?: any[];
    chainId?: number;
    value?: bigint;
  }) => {
    if (!provider) {
      throw new Error("Wallet provider not available. Please reconnect your wallet.");
    }

    let fromAddress = accountAddress;
    if (!fromAddress) {
      const accounts = await provider.request({ method: 'eth_accounts' });
      fromAddress = accounts?.[0];
    }

    if (!fromAddress) {
      throw new Error("No wallet address available");
    }

    setIsPending(true);
    setError(null);
    setIsError(false);
    setIsSuccess(false);

    try {
      // Encode function call data
      const { encodeFunctionData } = require('viem');
      const callData = encodeFunctionData({
        abi: params.abi,
        functionName: params.functionName,
        args: params.args || [],
      });

      console.log("[wagmi-native] writeContractAsync:", {
        to: params.address,
        from: fromAddress,
        functionName: params.functionName,
        data: callData.slice(0, 20) + '...',
      });

      // Try to open wallet app
      try {
        const { Linking } = require('react-native');
        Linking.openURL('wc:').catch(() => {
          Linking.openURL('metamask:').catch(() => {});
        });
      } catch (e) {}

      const txParams: any = {
        from: fromAddress,
        to: params.address,
        data: callData,
      };

      if (params.value) {
        txParams.value = '0x' + params.value.toString(16);
      }

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      console.log("[wagmi-native] Contract tx hash:", hash);
      setData(hash);
      setIsSuccess(true);
      setIsPending(false);
      return hash;
    } catch (err: any) {
      console.error("[wagmi-native] writeContractAsync error:", err);
      setError(err);
      setIsError(true);
      setIsPending(false);
      throw err;
    }
  }, [provider, accountAddress]);

  const writeContract = React.useCallback((params: any) => {
    writeContractAsync(params).catch(() => {});
  }, [writeContractAsync]);

  const reset = React.useCallback(() => {
    setData(undefined);
    setError(null);
    setIsPending(false);
    setIsSuccess(false);
    setIsError(false);
  }, []);

  return {
    writeContract,
    writeContractAsync,
    data,
    error,
    isError,
    isIdle: !isPending && !isSuccess && !isError,
    isLoading: isPending,
    isPending,
    isSuccess,
    reset,
    status: isPending ? 'pending' : isSuccess ? 'success' : isError ? 'error' : 'idle',
  };
};

export const useDisconnect = () => ({
  disconnect: () => {},
  disconnectAsync: async () => {},
  error: null,
  isError: false,
  isIdle: true,
  isLoading: false,
  isPending: false,
  isSuccess: false,
  reset: () => {},
  status: 'idle',
});

export const useSignMessage = () => ({
  signMessage: () => {},
  signMessageAsync: async () => '',
  data: undefined,
  error: null,
  isError: false,
  isIdle: true,
  isLoading: false,
  isPending: false,
  isSuccess: false,
  reset: () => {},
  status: 'idle',
});

export const useConnect = () => ({
  connect: () => {},
  connectAsync: async () => {},
  connectors: [],
  data: undefined,
  error: null,
  isError: false,
  isIdle: true,
  isLoading: false,
  isPending: false,
  isSuccess: false,
  reset: () => {},
  status: 'idle',
});
