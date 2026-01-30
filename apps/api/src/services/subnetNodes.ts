import { ethers } from "ethers";
import { prisma } from "../prisma";
import { ollamaService, OllamaNode } from "./ollama";

/**
 * SubnetNodeService - Manages interaction with the ZeroPrompt subnet smart contracts
 * Handles reading operator data from blockchain and reporting requests for rewards
 */

// ABI fragments for the contracts we interact with (address-based, no NFT)
const OPERATOR_REGISTRY_ABI = [
  "function getActiveOperators() view returns (address[])",
  "function getOperator(address operator) view returns (string endpoint, string[] supportedModels, bool isRegistered, uint256 registeredAt, uint256 lastUpdated)",
  "function getOperatorDetails(address operator) view returns (uint256 stakeAmount, uint256 performanceScore, bool active)",
  "function calculatePerformanceScore(address operator) view returns (uint256)",
  "function getStakeWeight(address operator) view returns (uint256)",
  "function isOperatorActive(address operator) view returns (bool)",
  "function stakes(address operator) view returns (uint256 amount, uint256 stakedAt, uint256 lastRewardClaim, uint256 pendingUnstake, uint256 unstakeRequestedAt)",
];

const SUBNET_REWARDS_ABI = [
  "function recordRequests(address operator, uint256 requests, uint256 successful, uint256 totalLatencyMs)",
  "function batchRecordRequests(address[] operatorAddrs, uint256[] requestCounts, uint256[] successCounts, uint256[] latencies)",
  "function currentEpoch() view returns (uint256)",
  "function getPendingRewards(address operator) view returns (uint256)",
  "function getCurrentEpochStats(address operator) view returns (uint256 requests, uint256 successful, uint256 avgLatencyMs, uint256 weightedRequests, uint256 estimatedReward)",
];

interface RequestBatch {
  address: string;
  requests: number;
  successful: number;
  totalLatencyMs: number;
}

class SubnetNodeService {
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | null = null;
  private operatorRegistry: ethers.Contract | null = null;
  private subnetRewards: ethers.Contract | null = null;

  // In-memory request buffer for batching
  private requestBuffer: Map<string, RequestBatch> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 60000; // 1 minute
  private readonly CACHE_REFRESH_INTERVAL = 300000; // 5 minutes

  private initialized = false;

  /**
   * Initialize the service with contract addresses
   */
  async initialize(config: {
    rpcUrl: string;
    privateKey: string;
    operatorRegistryAddress: string;
    subnetRewardsAddress: string;
  }): Promise<void> {
    try {
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
      this.signer = new ethers.Wallet(config.privateKey, this.provider);

      this.operatorRegistry = new ethers.Contract(
        config.operatorRegistryAddress,
        OPERATOR_REGISTRY_ABI,
        this.signer // Need signer for write operations
      );

      this.subnetRewards = new ethers.Contract(
        config.subnetRewardsAddress,
        SUBNET_REWARDS_ABI,
        this.signer
      );

      this.initialized = true;
      console.log("[SubnetNodes] Initialized with contracts");

      // Initial sync of operators
      await this.syncOperatorsToCache();

      // Start periodic sync
      this.startPeriodicSync();
    } catch (error) {
      console.error("[SubnetNodes] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get active operators from blockchain and sync to cache
   */
  async getActiveOperators(): Promise<OllamaNode[]> {
    if (!this.initialized || !this.operatorRegistry) {
      // Return cached operators if not initialized
      return this.getCachedOperators();
    }

    try {
      const activeAddresses: string[] =
        await this.operatorRegistry.getActiveOperators();

      const operators: OllamaNode[] = [];

      for (const operatorAddr of activeAddresses) {
        try {
          const [endpoint, supportedModels, isRegistered] =
            await this.operatorRegistry.getOperator(operatorAddr);

          const [, performanceScore, active] =
            await this.operatorRegistry.getOperatorDetails(operatorAddr);

          const stakeWeight = await this.operatorRegistry.getStakeWeight(operatorAddr);

          if (active && isRegistered) {
            operators.push({
              address: operatorAddr,
              endpoint,
              supportedModels,
              isHealthy: false, // Will be determined by health checks
              lastHealthCheck: new Date(0),
              latencyMs: 0,
              performanceScore: Number(performanceScore),
              stakeWeight: Number(stakeWeight),
            });
          }
        } catch (err) {
          console.error(
            `[SubnetNodes] Failed to get operator ${operatorAddr}:`,
            err
          );
        }
      }

      return operators;
    } catch (error) {
      console.error("[SubnetNodes] Failed to get active operators:", error);
      return this.getCachedOperators();
    }
  }

  /**
   * Get operators from database cache
   */
  private async getCachedOperators(): Promise<OllamaNode[]> {
    const cached = await prisma.operatorCache.findMany({
      where: { isActive: true },
    });

    return cached.map((op) => ({
      address: op.operatorAddress || "",
      endpoint: op.endpoint,
      supportedModels: op.supportedModels as string[],
      isHealthy: false,
      lastHealthCheck: new Date(0),
      latencyMs: 0,
      performanceScore: op.performanceScore,
      stakeWeight: 100, // Default weight
    }));
  }

  /**
   * Sync operators from blockchain to database cache
   */
  async syncOperatorsToCache(): Promise<void> {
    const operators = await this.getActiveOperators();

    for (const op of operators) {
      await prisma.operatorCache.upsert({
        where: { operatorAddress: op.address },
        update: {
          endpoint: op.endpoint,
          supportedModels: op.supportedModels,
          performanceScore: op.performanceScore,
          isActive: true,
        },
        create: {
          operatorAddress: op.address,
          tokenId: 0, // Legacy field, no longer used
          endpoint: op.endpoint,
          supportedModels: op.supportedModels,
          stakeAmount: "0",
          performanceScore: op.performanceScore,
          isActive: true,
        },
      });
    }

    // Update OllamaService with new operators
    ollamaService.updateOperators(operators);

    // Start health checks if not already running
    ollamaService.startHealthChecks();

    console.log(`[SubnetNodes] Synced ${operators.length} operators to cache`);
  }

  /**
   * Report a successful request for a node (buffers for batch sync)
   */
  async reportRequest(
    operatorAddress: string,
    success: boolean = true,
    latencyMs: number = 0
  ): Promise<void> {
    // Buffer the request for batch processing
    const existing = this.requestBuffer.get(operatorAddress);

    if (existing) {
      existing.requests++;
      if (success) existing.successful++;
      existing.totalLatencyMs += latencyMs;
    } else {
      this.requestBuffer.set(operatorAddress, {
        address: operatorAddress,
        requests: 1,
        successful: success ? 1 : 0,
        totalLatencyMs: latencyMs,
      });
    }

    // Also log to database immediately
    await prisma.ollamaRequestLog.create({
      data: {
        operatorTokenId: 0, // Legacy field
        operatorAddress,
        model: "unknown", // Will be updated by caller
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        success,
        synced: false,
      },
    });
  }

  /**
   * Report a request with full details
   */
  async reportRequestDetailed(
    operatorAddress: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs: number,
    success: boolean
  ): Promise<void> {
    // Buffer for batch sync
    const existing = this.requestBuffer.get(operatorAddress);
    if (existing) {
      existing.requests++;
      if (success) existing.successful++;
      existing.totalLatencyMs += latencyMs;
    } else {
      this.requestBuffer.set(operatorAddress, {
        address: operatorAddress,
        requests: 1,
        successful: success ? 1 : 0,
        totalLatencyMs: latencyMs,
      });
    }

    // Log to database
    await prisma.ollamaRequestLog.create({
      data: {
        operatorTokenId: 0, // Legacy field
        operatorAddress,
        model,
        inputTokens,
        outputTokens,
        latencyMs,
        success,
        synced: false,
      },
    });
  }

  /**
   * Sync buffered requests to blockchain
   */
  async syncRequestsToChain(): Promise<void> {
    if (!this.initialized || !this.subnetRewards) {
      console.log("[SubnetNodes] Not initialized, skipping sync");
      return;
    }

    if (this.requestBuffer.size === 0) {
      return;
    }

    const batches = Array.from(this.requestBuffer.values());
    this.requestBuffer.clear();

    try {
      if (batches.length === 1) {
        // Single record
        const batch = batches[0];
        const tx = await this.subnetRewards.recordRequests(
          batch.address,
          batch.requests,
          batch.successful,
          batch.totalLatencyMs
        );
        await tx.wait();
        console.log(
          `[SubnetNodes] Recorded ${batch.requests} requests for operator ${batch.address}`
        );
      } else {
        // Batch record
        const addresses = batches.map((b) => b.address);
        const requestCounts = batches.map((b) => b.requests);
        const successCounts = batches.map((b) => b.successful);
        const latencies = batches.map((b) => b.totalLatencyMs);

        const tx = await this.subnetRewards.batchRecordRequests(
          addresses,
          requestCounts,
          successCounts,
          latencies
        );
        await tx.wait();
        console.log(
          `[SubnetNodes] Batch recorded requests for ${batches.length} operators`
        );
      }

      // Mark logs as synced
      const addresses = batches.map((b) => b.address);
      await prisma.ollamaRequestLog.updateMany({
        where: {
          operatorAddress: { in: addresses },
          synced: false,
        },
        data: { synced: true },
      });
    } catch (error) {
      console.error("[SubnetNodes] Failed to sync requests to chain:", error);
      // Re-add to buffer for retry
      for (const batch of batches) {
        const existing = this.requestBuffer.get(batch.address);
        if (existing) {
          existing.requests += batch.requests;
          existing.successful += batch.successful;
          existing.totalLatencyMs += batch.totalLatencyMs;
        } else {
          this.requestBuffer.set(batch.address, batch);
        }
      }
    }
  }

  /**
   * Get pending rewards for an operator
   */
  async getPendingRewards(operatorAddress: string): Promise<string> {
    if (!this.initialized || !this.subnetRewards) {
      return "0";
    }

    try {
      const rewards = await this.subnetRewards.getPendingRewards(operatorAddress);
      return ethers.formatEther(rewards);
    } catch (error) {
      console.error("[SubnetNodes] Failed to get pending rewards:", error);
      return "0";
    }
  }

  /**
   * Get current epoch stats for an operator
   */
  async getCurrentEpochStats(operatorAddress: string): Promise<{
    requests: number;
    successful: number;
    avgLatencyMs: number;
    weightedRequests: number;
    estimatedReward: string;
  }> {
    if (!this.initialized || !this.subnetRewards) {
      return {
        requests: 0,
        successful: 0,
        avgLatencyMs: 0,
        weightedRequests: 0,
        estimatedReward: "0",
      };
    }

    try {
      const [requests, successful, avgLatencyMs, weightedRequests, estimatedReward] =
        await this.subnetRewards.getCurrentEpochStats(operatorAddress);

      return {
        requests: Number(requests),
        successful: Number(successful),
        avgLatencyMs: Number(avgLatencyMs),
        weightedRequests: Number(weightedRequests),
        estimatedReward: ethers.formatEther(estimatedReward),
      };
    } catch (error) {
      console.error("[SubnetNodes] Failed to get epoch stats:", error);
      return {
        requests: 0,
        successful: 0,
        avgLatencyMs: 0,
        weightedRequests: 0,
        estimatedReward: "0",
      };
    }
  }

  /**
   * Get operator details
   */
  async getOperatorDetails(operatorAddress: string): Promise<{
    endpoint: string;
    supportedModels: string[];
    stakeAmount: string;
    performanceScore: number;
    stakeWeight: number;
    isActive: boolean;
    pendingRewards: string;
  } | null> {
    if (!this.initialized || !this.operatorRegistry) {
      // Try from cache
      const cached = await prisma.operatorCache.findFirst({
        where: { operatorAddress },
      });
      if (cached) {
        return {
          endpoint: cached.endpoint,
          supportedModels: cached.supportedModels as string[],
          stakeAmount: cached.stakeAmount,
          performanceScore: cached.performanceScore,
          stakeWeight: 100,
          isActive: cached.isActive,
          pendingRewards: "0",
        };
      }
      return null;
    }

    try {
      const [endpoint, supportedModels, isRegistered] =
        await this.operatorRegistry.getOperator(operatorAddress);

      const [stakeAmount, performanceScore, active] =
        await this.operatorRegistry.getOperatorDetails(operatorAddress);

      const stakeWeight = await this.operatorRegistry.getStakeWeight(operatorAddress);
      const pendingRewards = await this.getPendingRewards(operatorAddress);

      return {
        endpoint,
        supportedModels,
        stakeAmount: ethers.formatEther(stakeAmount),
        performanceScore: Number(performanceScore),
        stakeWeight: Number(stakeWeight),
        isActive: isRegistered && active,
        pendingRewards,
      };
    } catch (error) {
      console.error("[SubnetNodes] Failed to get operator details:", error);
      return null;
    }
  }

  /**
   * Start periodic sync to blockchain
   */
  private startPeriodicSync(): void {
    // Sync requests to chain every minute
    this.syncInterval = setInterval(async () => {
      await this.syncRequestsToChain();
    }, this.SYNC_INTERVAL);

    // Refresh operator cache every 5 minutes
    setInterval(async () => {
      await this.syncOperatorsToCache();
    }, this.CACHE_REFRESH_INTERVAL);

    console.log("[SubnetNodes] Periodic sync started");
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Graceful shutdown - sync remaining requests
   */
  async shutdown(): Promise<void> {
    this.stopPeriodicSync();
    await this.syncRequestsToChain();
  }
}

// Singleton instance
export const subnetNodeService = new SubnetNodeService();
