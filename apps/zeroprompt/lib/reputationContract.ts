/**
 * ModelReputationRegistry Contract Interface
 * ERC-8004 On-Chain AI Model Reputation
 *
 * Contract: 0x3A7e2E328618175bfeb1d1581a79aDf999214c7d
 * Network: Avalanche C-Chain (43114)
 */

import { ethers } from 'ethers';

export const MODEL_REPUTATION_REGISTRY_ADDRESS =
  process.env.EXPO_PUBLIC_MODEL_REPUTATION_REGISTRY ||
  '0x3A7e2E328618175bfeb1d1581a79aDf999214c7d';

export const AVALANCHE_RPC = 'https://api.avax.network/ext/bc/C/rpc';
export const AVALANCHE_CHAIN_ID = 43114;

export const MODEL_REPUTATION_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "modelId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "rater", "type": "address" },
      { "indexed": false, "internalType": "uint8", "name": "score", "type": "uint8" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "ModelRated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "modelId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "rater", "type": "address" },
      { "indexed": false, "internalType": "uint8", "name": "oldScore", "type": "uint8" },
      { "indexed": false, "internalType": "uint8", "name": "newScore", "type": "uint8" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "RatingUpdated",
    "type": "event"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "modelId", "type": "uint256" }, { "internalType": "uint8", "name": "score", "type": "uint8" }],
    "name": "rateModel",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "modelId", "type": "uint256" }, { "internalType": "address", "name": "rater", "type": "address" }],
    "name": "getRating",
    "outputs": [
      { "internalType": "uint8", "name": "score", "type": "uint8" },
      { "internalType": "uint48", "name": "timestamp", "type": "uint48" },
      { "internalType": "bool", "name": "exists", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "modelId", "type": "uint256" }],
    "name": "getReputation",
    "outputs": [
      { "internalType": "uint256", "name": "totalRatings", "type": "uint256" },
      { "internalType": "uint256", "name": "averageScore", "type": "uint256" },
      { "internalType": "uint256[5]", "name": "distribution", "type": "uint256[5]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRatedModelsCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "offset", "type": "uint256" }, { "internalType": "uint256", "name": "limit", "type": "uint256" }],
    "name": "getRatedModelIds",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalRatingsCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Read-only provider for fetching data
export function getProvider() {
  return new ethers.JsonRpcProvider(AVALANCHE_RPC);
}

// Get read-only contract instance
export function getReputationContract() {
  const provider = getProvider();
  return new ethers.Contract(
    MODEL_REPUTATION_REGISTRY_ADDRESS,
    MODEL_REPUTATION_ABI,
    provider
  );
}

// Get contract with signer for write operations
export function getReputationContractWithSigner(signer: ethers.Signer) {
  return new ethers.Contract(
    MODEL_REPUTATION_REGISTRY_ADDRESS,
    MODEL_REPUTATION_ABI,
    signer
  );
}

// Types
export interface OnChainReputation {
  totalRatings: number;
  averageScore: number; // Already divided by 100 for precision
  distribution: [number, number, number, number, number]; // [1star, 2star, 3star, 4star, 5star]
}

export interface OnChainRating {
  score: number;
  timestamp: number;
  exists: boolean;
}

// Helper functions
export async function fetchModelReputation(modelId: number): Promise<OnChainReputation> {
  const contract = getReputationContract();
  const [totalRatings, averageScore, distribution] = await contract.getReputation(modelId);

  return {
    totalRatings: Number(totalRatings),
    averageScore: Number(averageScore) / 100, // Convert from x100 format
    distribution: distribution.map((n: bigint) => Number(n)) as [number, number, number, number, number]
  };
}

export async function fetchUserRating(modelId: number, userAddress: string): Promise<OnChainRating> {
  const contract = getReputationContract();
  const [score, timestamp, exists] = await contract.getRating(modelId, userAddress);

  return {
    score: Number(score),
    timestamp: Number(timestamp),
    exists
  };
}

export async function fetchTotalRatingsCount(): Promise<number> {
  const contract = getReputationContract();
  const count = await contract.totalRatingsCount();
  return Number(count);
}

export async function fetchRatedModelsCount(): Promise<number> {
  const contract = getReputationContract();
  const count = await contract.getRatedModelsCount();
  return Number(count);
}

// Submit rating transaction
export async function submitRating(
  modelId: number,
  score: number,
  signer: ethers.Signer
): Promise<string> {
  if (score < 1 || score > 5) {
    throw new Error('Score must be between 1 and 5');
  }

  const contract = getReputationContractWithSigner(signer);
  const tx = await contract.rateModel(modelId, score);
  const receipt = await tx.wait();

  return receipt.hash;
}

// Check if connected to Avalanche
export async function ensureAvalancheNetwork(provider: any): Promise<boolean> {
  try {
    const network = await provider.getNetwork();
    return Number(network.chainId) === AVALANCHE_CHAIN_ID;
  } catch {
    return false;
  }
}

// Switch to Avalanche network
export async function switchToAvalanche(provider: any): Promise<void> {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xa86a' }], // 43114 in hex
    });
  } catch (error: any) {
    // Chain not added, add it
    if (error.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0xa86a',
          chainName: 'Avalanche C-Chain',
          nativeCurrency: {
            name: 'AVAX',
            symbol: 'AVAX',
            decimals: 18,
          },
          rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
          blockExplorerUrls: ['https://snowtrace.io/'],
        }],
      });
    } else {
      throw error;
    }
  }
}
