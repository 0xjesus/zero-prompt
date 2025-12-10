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

// Stub hooks - these are not used on native, AppKit has its own hooks
export const useAccount = () => ({
  address: undefined,
  isConnected: false,
  isConnecting: false,
  isDisconnected: true,
  status: 'disconnected' as const,
});

export const useSignTypedData = () => ({
  signTypedData: () => {},
  signTypedDataAsync: async () => '',
  data: undefined,
  error: null,
  isError: false,
  isIdle: true,
  isLoading: false,
  isSuccess: false,
  reset: () => {},
  status: 'idle',
});

// Real implementation using AppKit provider
// Import hooks at module level
let useProviderHook: () => { provider: any } = () => ({ provider: null });
let useAccountHook: () => { address?: string } = () => ({ address: undefined });
try {
  const appKitRN = require("@reown/appkit-react-native");
  useProviderHook = appKitRN.useProvider;
  useAccountHook = appKitRN.useAccount;
} catch (e) {
  // AppKit not available
}

export const useSendTransaction = () => {
  const [data, setData] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<Error | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isError, setIsError] = React.useState(false);

  // Get provider and account from AppKit hooks (called at top level - follows hook rules)
  const { provider } = useProviderHook();
  const { address: accountAddress } = useAccountHook();

  const sendTransactionAsync = React.useCallback(async (params: {
    to: string;
    value?: bigint;
    data?: string;
    chainId?: number;
  }) => {
    if (!provider) {
      throw new Error("Wallet provider not available. Please reconnect your wallet.");
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
        to: params.to,
      };

      if (params.value) {
        txParams.value = '0x' + params.value.toString(16);
      }
      if (params.data) {
        txParams.data = params.data;
      }

      console.log("[wagmi-native] sendTransactionAsync params:", txParams);

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

export const useSwitchChain = () => ({
  switchChain: () => {},
  switchChainAsync: async () => {},
  chains: [],
  error: null,
  isError: false,
  isIdle: true,
  isLoading: false,
  isPending: false,
  isSuccess: false,
  reset: () => {},
  status: 'idle',
});

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

export const useWriteContract = () => ({
  writeContract: () => {},
  writeContractAsync: async () => '',
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
