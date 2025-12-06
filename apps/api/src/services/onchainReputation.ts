/**
 * On-Chain Reputation Service
 * Reads reputation data directly from the ModelReputationRegistry contract
 */

import { ethers } from "ethers";

const MODEL_REPUTATION_REGISTRY_ADDRESS =
  process.env.MODEL_REPUTATION_REGISTRY ||
  process.env.EXPO_PUBLIC_MODEL_REPUTATION_REGISTRY ||
  "0x3A7e2E328618175bfeb1d1581a79aDf999214c7d";

const AVALANCHE_RPC = process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc";

const ABI = [
  {
    inputs: [{ internalType: "uint256", name: "modelId", type: "uint256" }],
    name: "getReputation",
    outputs: [
      { internalType: "uint256", name: "totalRatings", type: "uint256" },
      { internalType: "uint256", name: "averageScore", type: "uint256" },
      { internalType: "uint256[5]", name: "distribution", type: "uint256[5]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalRatingsCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getRatedModelsCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "offset", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "getRatedModelIds",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
];

// Cache for reputation data (refresh every 5 minutes)
interface ReputationCache {
  data: Map<number, { totalRatings: number; averageScore: number }>;
  timestamp: number;
}

let cache: ReputationCache | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getProvider() {
  return new ethers.JsonRpcProvider(AVALANCHE_RPC);
}

function getContract() {
  const provider = getProvider();
  return new ethers.Contract(MODEL_REPUTATION_REGISTRY_ADDRESS, ABI, provider);
}

export interface OnChainReputation {
  totalRatings: number;
  averageScore: number;
  distribution?: number[];
}

/**
 * Fetch reputation for a single model from the contract
 */
export async function fetchModelReputationOnChain(modelId: number): Promise<OnChainReputation | null> {
  try {
    const contract = getContract();
    const [totalRatings, averageScore, distribution] = await contract.getReputation(modelId);

    const total = Number(totalRatings);
    if (total === 0) return null;

    return {
      totalRatings: total,
      averageScore: Number(averageScore) / 100, // Contract stores as x100
      distribution: distribution.map((n: bigint) => Number(n)),
    };
  } catch (error) {
    console.error(`[OnChainReputation] Failed to fetch for model ${modelId}:`, error);
    return null;
  }
}

/**
 * Fetch all reputations from the contract (with caching)
 */
export async function fetchAllReputationsOnChain(): Promise<Map<number, OnChainReputation>> {
  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data as Map<number, OnChainReputation>;
  }

  const reputations = new Map<number, OnChainReputation>();

  try {
    const contract = getContract();

    // Get list of rated model IDs
    const ratedCount = await contract.getRatedModelsCount();
    const count = Number(ratedCount);

    if (count === 0) {
      cache = { data: reputations, timestamp: Date.now() };
      return reputations;
    }

    // Fetch in batches
    const batchSize = 50;
    for (let offset = 0; offset < count; offset += batchSize) {
      const modelIds = await contract.getRatedModelIds(offset, batchSize);

      // Fetch reputation for each model in parallel
      const results = await Promise.all(
        modelIds.map(async (id: bigint) => {
          const modelId = Number(id);
          const rep = await fetchModelReputationOnChain(modelId);
          return { modelId, rep };
        })
      );

      for (const { modelId, rep } of results) {
        if (rep) {
          reputations.set(modelId, rep);
        }
      }
    }

    // Update cache
    cache = { data: reputations, timestamp: Date.now() };
    console.log(`[OnChainReputation] Cached ${reputations.size} model reputations from contract`);
  } catch (error) {
    console.error("[OnChainReputation] Failed to fetch all reputations:", error);
  }

  return reputations;
}

/**
 * Get reputation map for use in models endpoint
 */
export async function getReputationMap(): Promise<Record<number, { totalRatings: number; averageScore: number }>> {
  const reputations = await fetchAllReputationsOnChain();
  const map: Record<number, { totalRatings: number; averageScore: number }> = {};

  for (const [modelId, rep] of reputations) {
    map[modelId] = {
      totalRatings: rep.totalRatings,
      averageScore: rep.averageScore,
    };
  }

  return map;
}

/**
 * Clear the cache (useful after a new rating is submitted)
 */
export function clearReputationCache() {
  cache = null;
}

/**
 * Get contract address
 */
export function getContractAddress() {
  return MODEL_REPUTATION_REGISTRY_ADDRESS;
}
