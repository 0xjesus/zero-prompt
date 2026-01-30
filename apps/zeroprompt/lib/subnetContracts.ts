/**
 * Subnet Contract Addresses & ABIs (ZeroPrompt Subnet)
 * Provides contract interaction helpers for the ZeroPrompt subnet.
 */

import { ethers } from 'ethers';

// --- Chain ---
export const SUBNET_CHAIN_ID = 432001;
export const SUBNET_RPC = process.env.EXPO_PUBLIC_SUBNET_RPC || 'https://subnet.qcdr.io/ext/bc/3CbiMLH1ePtEgrYt96U6St1WYLq2WurzXAuBbgHjq15mcgLKp/rpc';

// --- Contract Addresses ---
export const ZEROP_TOKEN_ADDRESS = '0x5aa01B3b5877255cE50cc55e8986a7a5fe29C70e';
export const OPERATOR_REGISTRY_ADDRESS = '0x4Ac1d98D9cEF99EC6546dEd4Bd550b0b287aaD6D';
export const SUBNET_REWARDS_ADDRESS = '0xA4cD3b0Eb6E5Ab5d8CE4065BcCD70040ADAB1F00';

// --- Minimal ABIs ---

export const ERC20_ABI = [
  {
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const OPERATOR_REGISTRY_ABI = [
  {
    inputs: [{ name: 'endpoint', type: 'string' }, { name: 'supportedModels', type: 'string[]' }],
    name: 'registerOperator',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'newEndpoint', type: 'string' }],
    name: 'updateEndpoint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'models', type: 'string[]' }],
    name: 'setSupportedModels',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'stake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'additionalAmount', type: 'uint256' }],
    name: 'increaseStake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'requestUnstake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'unstake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'operator', type: 'address' }],
    name: 'getOperator',
    outputs: [
      { name: 'endpoint', type: 'string' },
      { name: 'supportedModels', type: 'string[]' },
      { name: 'isRegistered', type: 'bool' },
      { name: 'registeredAt', type: 'uint256' },
      { name: 'lastUpdated', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'operator', type: 'address' }],
    name: 'getOperatorDetails',
    outputs: [
      { name: 'stakeAmount', type: 'uint256' },
      { name: 'performanceScore', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'operator', type: 'address' }],
    name: 'isOperatorActive',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'operator', type: 'address' }],
    name: 'stakes',
    outputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'stakedAt', type: 'uint256' },
      { name: 'lastRewardClaim', type: 'uint256' },
      { name: 'pendingUnstake', type: 'uint256' },
      { name: 'unstakeRequestedAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getActiveOperators',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getActiveOperatorCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MIN_STAKE_AMOUNT',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const SUBNET_REWARDS_ABI = [
  {
    inputs: [{ name: 'epoch', type: 'uint256' }],
    name: 'claimRewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'epochList', type: 'uint256[]' }],
    name: 'claimMultipleEpochs',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'operator', type: 'address' }],
    name: 'getPendingRewards',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getGlobalEpochStats',
    outputs: [
      { name: 'epoch', type: 'uint256' },
      { name: 'totalRewards', type: 'uint256' },
      { name: 'totalStaked', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'currentEpoch',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// --- Read-only provider ---

export function getSubnetProvider() {
  const network = new ethers.Network('zeroprompt-subnet', SUBNET_CHAIN_ID);
  return new ethers.JsonRpcProvider(SUBNET_RPC, network, { staticNetwork: network });
}

// --- Read-only contract instances ---

export function getZeropToken() {
  return new ethers.Contract(ZEROP_TOKEN_ADDRESS, ERC20_ABI, getSubnetProvider());
}

export function getOperatorRegistry() {
  return new ethers.Contract(OPERATOR_REGISTRY_ADDRESS, OPERATOR_REGISTRY_ABI, getSubnetProvider());
}

export function getSubnetRewards() {
  return new ethers.Contract(SUBNET_REWARDS_ADDRESS, SUBNET_REWARDS_ABI, getSubnetProvider());
}

// --- Formatting helpers ---

/** Format a raw bigint ZEROP amount (18 decimals) to a human-readable string */
export function formatZerop(value: bigint): string {
  return ethers.formatUnits(value, 18);
}

/** Parse a human-readable ZEROP string into a raw bigint (18 decimals) */
export function parseZerop(value: string): bigint {
  return ethers.parseUnits(value, 18);
}

// --- Helper reads ---

export async function fetchZeropBalance(address: string): Promise<bigint> {
  const token = getZeropToken();
  return token.balanceOf(address);
}

export interface OperatorOnChain {
  address: string;
  endpoint: string;
  supportedModels: string[];
  isRegistered: boolean;
  stakeAmount: bigint;
  performanceScore: number;
  isActive: boolean;
}

export async function fetchOperatorOnChain(operatorAddress: string): Promise<OperatorOnChain> {
  const registry = getOperatorRegistry();

  const [operatorData, details] = await Promise.all([
    registry.getOperator(operatorAddress),
    registry.getOperatorDetails(operatorAddress),
  ]);

  return {
    address: operatorAddress,
    endpoint: operatorData[0],
    supportedModels: operatorData[1],
    isRegistered: operatorData[2],
    stakeAmount: details[0],
    performanceScore: Number(details[1]),
    isActive: details[2],
  };
}

export async function fetchActiveOperators(): Promise<string[]> {
  const registry = getOperatorRegistry();
  return registry.getActiveOperators();
}

export async function fetchMinStake(): Promise<bigint> {
  const registry = getOperatorRegistry();
  return registry.MIN_STAKE_AMOUNT();
}

export async function fetchPendingRewards(operatorAddress: string): Promise<bigint> {
  const rewards = getSubnetRewards();
  return rewards.getPendingRewards(operatorAddress);
}

export async function fetchCurrentEpoch(): Promise<number> {
  const rewards = getSubnetRewards();
  const epoch = await rewards.currentEpoch();
  return Number(epoch);
}

// --- Subnet network switching ---

export async function switchToSubnet(provider: any): Promise<void> {
  const chainIdHex = '0x' + SUBNET_CHAIN_ID.toString(16); // 0x69781
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (error: any) {
    if (error.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: 'ZeroPrompt Subnet',
          nativeCurrency: { name: 'ZEROP', symbol: 'ZEROP', decimals: 18 },
          rpcUrls: [SUBNET_RPC],
        }],
      });
    } else {
      throw error;
    }
  }
}
