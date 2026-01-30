import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import {
  fetchZeropBalance,
  fetchOperatorOnChain,
  formatZerop,
  type OperatorOnChain,
} from '../lib/subnetContracts';

interface SubnetContextType {
  myOperator: OperatorOnChain | null;
  zeropBalance: string;
  zeropBalanceRaw: bigint;
  isLoadingOperator: boolean;
  refreshMyOperator: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const SubnetContext = createContext<SubnetContextType>({} as SubnetContextType);

export const SubnetProvider = ({ children }: { children: React.ReactNode }) => {
  const { address, isConnected } = useAccount();
  const [myOperator, setMyOperator] = useState<OperatorOnChain | null>(null);
  const [zeropBalanceRaw, setZeropBalanceRaw] = useState<bigint>(BigInt(0));
  const [isLoadingOperator, setIsLoadingOperator] = useState(false);

  const zeropBalance = formatZerop(zeropBalanceRaw);

  const refreshBalance = useCallback(async () => {
    if (!address) {
      setZeropBalanceRaw(BigInt(0));
      return;
    }
    try {
      const bal = await fetchZeropBalance(address);
      setZeropBalanceRaw(bal);
    } catch (err) {
      console.error('[Subnet] Failed to fetch ZEROP balance:', err);
    }
  }, [address]);

  const refreshMyOperator = useCallback(async () => {
    if (!address) {
      setMyOperator(null);
      return;
    }
    setIsLoadingOperator(true);
    try {
      const operator = await fetchOperatorOnChain(address);
      if (operator.isRegistered) {
        setMyOperator(operator);
      } else {
        setMyOperator(null);
      }
    } catch (err) {
      console.error('[Subnet] Failed to fetch operator:', err);
      setMyOperator(null);
    } finally {
      setIsLoadingOperator(false);
    }
  }, [address]);

  // Auto-refresh when wallet address changes
  useEffect(() => {
    if (isConnected && address) {
      refreshBalance();
      refreshMyOperator();
    } else {
      setMyOperator(null);
      setZeropBalanceRaw(BigInt(0));
    }
  }, [address, isConnected, refreshBalance, refreshMyOperator]);

  return (
    <SubnetContext.Provider
      value={{
        myOperator,
        zeropBalance,
        zeropBalanceRaw,
        isLoadingOperator,
        refreshMyOperator,
        refreshBalance,
      }}
    >
      {children}
    </SubnetContext.Provider>
  );
};

export const useSubnet = () => useContext(SubnetContext);
