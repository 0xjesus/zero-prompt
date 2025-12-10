import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { ethers } from "ethers";
import { useAuth } from "./AuthContext";
import { getNetworkIdByChainId, SUPPORTED_CHAINS, DEFAULT_CHAIN_ID } from "../config/wagmi";
import { API_URL } from "../config/api";

// Types
export interface UserAccount {
  creditsUSD: string;
  totalDeposited: string;
  totalUsedUSD: string;
  depositCount: number;
  lastDepositTime: number;
  lastUsageTime: number;
  isActive: boolean;
}

export interface DepositInfo {
  user: string;
  amountNative: string;
  amountUSD: string;
  priceAtDeposit: string;
  timestamp: number;
  txId: string;
}

export interface UsageRecord {
  user: string;
  amountUSD: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
  requestId: string;
}

export interface NetworkInfo {
  id: string;
  config: {
    name: string;
    chainId: number;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: number;
    };
    blockExplorer: string;
  };
}

type BillingContextType = {
  // State
  account: UserAccount | null;
  deposits: DepositInfo[];
  usage: UsageRecord[];
  nativePrice: number | null;
  selectedNetwork: string;
  networks: NetworkInfo[];
  isLoading: boolean;
  isDepositing: boolean;
  error: string | null;
  showUpsaleModal: boolean;
  showDepositModal: boolean;
  requiredCredits: string | null;

  // Derived
  currentBalance: number;
  currencySymbol: string;
  hasCredits: (amount: number) => boolean;

  // Actions
  setSelectedNetwork: (networkId: string) => void;
  refreshBilling: () => Promise<void>;
  calculateCredits: (amountNative: string) => Promise<string | null>;
  calculateDeposit: (amountUSD: string) => Promise<string | null>;
  prepareDeposit: (amountNative: string) => Promise<any | null>;
  executeDeposit: (amountNative: string) => Promise<string | null>;
  openUpsaleModal: (requiredAmount?: string) => void;
  closeUpsaleModal: () => void;
  openDepositModal: (requiredAmount?: string) => void;
  closeDepositModal: () => void;
  checkAndPromptCredits: (estimatedCost: number) => boolean;
};

const BillingContext = createContext<BillingContextType>({} as BillingContextType);

// Free credits for guest users (in USD)
const FREE_GUEST_CREDITS = 0.50;

export const BillingProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, token, getHeaders } = useAuth();

  // State
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [deposits, setDeposits] = useState<DepositInfo[]>([]);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [nativePrice, setNativePrice] = useState<number | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("avalanche");
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpsaleModal, setShowUpsaleModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [requiredCredits, setRequiredCredits] = useState<string | null>(null);

  // Derived values
  const currentBalance = account ? parseFloat(account.creditsUSD) : (user ? 0 : FREE_GUEST_CREDITS);
  const currentNetwork = networks.find((n) => n.id === selectedNetwork);
  const currencySymbol = currentNetwork?.config.nativeCurrency.symbol || "AVAX";

  // Check if user has enough credits
  const hasCredits = useCallback((amount: number): boolean => {
    return currentBalance >= amount;
  }, [currentBalance]);

  // Open upsale modal
  const openUpsaleModal = useCallback((requiredAmount?: string) => {
    setRequiredCredits(requiredAmount || null);
    setShowUpsaleModal(true);
  }, []);

  // Close upsale modal
  const closeUpsaleModal = useCallback(() => {
    setShowUpsaleModal(false);
    setRequiredCredits(null);
  }, []);

  // Open deposit modal
  const openDepositModal = useCallback((requiredAmount?: string) => {
    console.log("[Billing] openDepositModal called, requiredAmount:", requiredAmount);
    setRequiredCredits(requiredAmount || null);
    setShowDepositModal(true);
    console.log("[Billing] showDepositModal set to true");
  }, []);

  // Close deposit modal
  const closeDepositModal = useCallback(() => {
    setShowDepositModal(false);
    setRequiredCredits(null);
  }, []);

  // Check credits and prompt if insufficient
  const checkAndPromptCredits = useCallback((estimatedCost: number): boolean => {
    if (currentBalance >= estimatedCost) {
      return true;
    }
    openDepositModal(estimatedCost.toFixed(4));
    return false;
  }, [currentBalance, openDepositModal]);

  // Fetch supported networks
  const fetchNetworks = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/billing/networks`);
      if (res.ok) {
        const data = await res.json();
        setNetworks(data.networks || []);
      }
    } catch (err) {
      console.error("Failed to fetch networks:", err);
    }
  }, []);

  // Fetch native token price
  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/billing/price/${selectedNetwork}`);
      if (res.ok) {
        const data = await res.json();
        setNativePrice(data.price);
      }
    } catch (err) {
      console.error("Failed to fetch price:", err);
    }
  }, [selectedNetwork]);

  // Fetch user account
  const fetchAccount = useCallback(async () => {
    if (!user?.walletAddress) return;

    try {
      const res = await fetch(
        `${API_URL}/billing/account/${user.walletAddress}/${selectedNetwork}`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setAccount(data.account);
      }
    } catch (err) {
      console.error("Failed to fetch account:", err);
    }
  }, [user?.walletAddress, selectedNetwork, getHeaders]);

  // Fetch deposits
  const fetchDeposits = useCallback(async () => {
    if (!user?.walletAddress) return;

    try {
      const res = await fetch(
        `${API_URL}/billing/deposits/${user.walletAddress}/${selectedNetwork}`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setDeposits(data.deposits || []);
      }
    } catch (err) {
      console.error("Failed to fetch deposits:", err);
    }
  }, [user?.walletAddress, selectedNetwork, getHeaders]);

  // Fetch usage
  const fetchUsage = useCallback(async () => {
    if (!user?.walletAddress) return;

    try {
      const res = await fetch(
        `${API_URL}/billing/usage/${user.walletAddress}/${selectedNetwork}`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setUsage(data.usage || []);
      }
    } catch (err) {
      console.error("Failed to fetch usage:", err);
    }
  }, [user?.walletAddress, selectedNetwork, getHeaders]);

  // Refresh all billing data
  const refreshBilling = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([fetchPrice(), fetchAccount(), fetchDeposits(), fetchUsage()]);
    } catch (err: any) {
      setError(err.message || "Failed to refresh billing data");
    } finally {
      setIsLoading(false);
    }
  }, [fetchPrice, fetchAccount, fetchDeposits, fetchUsage]);

  // Calculate credits for native amount
  const calculateCredits = useCallback(
    async (amountNative: string): Promise<string | null> => {
      try {
        const res = await fetch(
          `${API_URL}/billing/calculate-credits/${amountNative}/${selectedNetwork}`
        );
        if (res.ok) {
          const data = await res.json();
          return data.creditsUSD;
        }
        return null;
      } catch (err) {
        console.error("Failed to calculate credits:", err);
        return null;
      }
    },
    [selectedNetwork]
  );

  // Calculate deposit for USD amount
  const calculateDeposit = useCallback(
    async (amountUSD: string): Promise<string | null> => {
      try {
        const res = await fetch(
          `${API_URL}/billing/calculate-deposit/${amountUSD}/${selectedNetwork}`
        );
        if (res.ok) {
          const data = await res.json();
          return data.amountNative;
        }
        return null;
      } catch (err) {
        console.error("Failed to calculate deposit:", err);
        return null;
      }
    },
    [selectedNetwork]
  );

  // Prepare deposit transaction
  const prepareDeposit = useCallback(
    async (amountNative: string): Promise<any | null> => {
      try {
        const res = await fetch(`${API_URL}/billing/prepare-deposit`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ amountNative, networkId: selectedNetwork })
        });
        if (res.ok) {
          const data = await res.json();
          return data;
        }
        return null;
      } catch (err) {
        console.error("Failed to prepare deposit:", err);
        return null;
      }
    },
    [selectedNetwork, getHeaders]
  );

  // Execute deposit (sign and send transaction)
  const executeDeposit = useCallback(
    async (amountNative: string): Promise<string | null> => {
      if (Platform.OS !== "web" || !(window as any).ethereum) {
        setError("Wallet not available");
        return null;
      }

      setIsDepositing(true);
      setError(null);

      try {
        // Get transaction details from backend
        const prepData = await prepareDeposit(amountNative);
        if (!prepData) {
          throw new Error("Failed to prepare deposit");
        }

        const { transaction, estimatedCreditsUSD } = prepData;

        // Get provider and signer
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();

        // Check if on correct network
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== transaction.chainId) {
          // Request network switch
          try {
            await (window as any).ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: `0x${transaction.chainId.toString(16)}` }]
            });
          } catch (switchError: any) {
            // Chain not added, try to add it
            if (switchError.code === 4902) {
              const chainConfig = Object.values(SUPPORTED_CHAINS).find(
                (c) => c.id === transaction.chainId
              );
              if (chainConfig) {
                await (window as any).ethereum.request({
                  method: "wallet_addEthereumChain",
                  params: [
                    {
                      chainId: `0x${transaction.chainId.toString(16)}`,
                      chainName: chainConfig.name,
                      nativeCurrency: chainConfig.nativeCurrency,
                      rpcUrls: [chainConfig.rpcUrls.default.http[0]],
                      blockExplorerUrls: [chainConfig.blockExplorers.default.url]
                    }
                  ]
                });
              }
            } else {
              throw switchError;
            }
          }
        }

        // Send transaction
        const tx = await signer.sendTransaction({
          to: transaction.to,
          value: transaction.value,
          data: transaction.data
        });

        console.log("Deposit transaction sent:", tx.hash);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log("Deposit confirmed:", receipt);

        // Wait a bit for RPC to catch up, then refresh billing data
        await new Promise(resolve => setTimeout(resolve, 2000));
        await refreshBilling();

        // Retry refresh after another delay to ensure we get updated data
        await new Promise(resolve => setTimeout(resolve, 3000));
        await refreshBilling();

        // Close upsale modal on success
        setShowUpsaleModal(false);
        setRequiredCredits(null);

        return tx.hash;
      } catch (err: any) {
        console.error("Deposit failed:", err);
        setError(err.message || "Deposit failed");
        return null;
      } finally {
        setIsDepositing(false);
      }
    },
    [prepareDeposit, refreshBilling]
  );

  // Initial load
  useEffect(() => {
    fetchNetworks();
  }, [fetchNetworks]);

  // Refresh when network changes or user connects
  useEffect(() => {
    fetchPrice();
    if (user?.walletAddress) {
      refreshBilling();
    }
  }, [selectedNetwork, user?.walletAddress, fetchPrice, refreshBilling]);

  return (
    <BillingContext.Provider
      value={{
        account,
        deposits,
        usage,
        nativePrice,
        selectedNetwork,
        networks,
        isLoading,
        isDepositing,
        error,
        showUpsaleModal,
        showDepositModal,
        requiredCredits,
        currentBalance,
        currencySymbol,
        hasCredits,
        setSelectedNetwork,
        refreshBilling,
        calculateCredits,
        calculateDeposit,
        prepareDeposit,
        executeDeposit,
        openUpsaleModal,
        closeUpsaleModal,
        openDepositModal,
        closeDepositModal,
        checkAndPromptCredits
      }}
    >
      {children}
    </BillingContext.Provider>
  );
};

export const useBilling = () => useContext(BillingContext);
