import { Router } from "express";
import { prisma } from "../prisma";
import { checkAuth } from "../middleware/auth";
import { ollamaService } from "../services/ollama";
import { subnetNodeService } from "../services/subnetNodes";

export const operatorRouter = Router();

/**
 * GET /operators
 * List all active operators in the network
 */
operatorRouter.get("/", async (_req, res) => {
  try {
    // Get from cache first
    const cached = await prisma.operatorCache.findMany({
      where: { isActive: true },
      orderBy: { performanceScore: "desc" },
    });

    // Enrich with health data from OllamaService
    const operators = cached.map((op) => {
      const node = ollamaService.getAllNodes().find((n) => n.address === (op.operatorAddress || ""));
      return {
        address: op.operatorAddress || "",
        endpoint: op.endpoint,
        supportedModels: op.supportedModels,
        stakeAmount: op.stakeAmount,
        performanceScore: op.performanceScore,
        isActive: op.isActive,
        isHealthy: node?.isHealthy ?? false,
        latencyMs: node?.latencyMs ?? 0,
        lastHealthCheck: node?.lastHealthCheck ?? null,
      };
    });

    res.json({
      operators,
      total: operators.length,
      healthy: operators.filter((o) => o.isHealthy).length,
    });
  } catch (error) {
    console.error("Failed to fetch operators:", error);
    res.status(500).json({ error: "failed_to_fetch_operators" });
  }
});

/**
 * GET /operators/models
 * Get all models available across the decentralized network
 */
operatorRouter.get("/models", async (_req, res) => {
  try {
    const models = ollamaService.getAvailableModels();

    // Get node count per model
    const modelStats: { [key: string]: { nodeCount: number; avgLatency: number } } = {};

    for (const model of models) {
      const nodes = ollamaService.getHealthyNodes().filter((n) =>
        n.supportedModels.includes(model)
      );
      const avgLatency =
        nodes.length > 0
          ? nodes.reduce((sum, n) => sum + n.latencyMs, 0) / nodes.length
          : 0;

      modelStats[model] = {
        nodeCount: nodes.length,
        avgLatency: Math.round(avgLatency),
      };
    }

    res.json({
      models: models.map((m) => ({
        id: m,
        name: m,
        nodeCount: modelStats[m]?.nodeCount ?? 0,
        avgLatencyMs: modelStats[m]?.avgLatency ?? 0,
        available: (modelStats[m]?.nodeCount ?? 0) > 0,
      })),
      totalModels: models.length,
    });
  } catch (error) {
    console.error("Failed to fetch ollama models:", error);
    res.status(500).json({ error: "failed_to_fetch_models" });
  }
});

/**
 * GET /operators/health
 * Get network health summary
 */
operatorRouter.get("/health", async (_req, res) => {
  try {
    const summary = ollamaService.getHealthySummary();
    const nodes = ollamaService.getAllNodes();

    res.json({
      totalNodes: summary.total,
      healthyNodes: summary.healthy,
      unhealthyNodes: summary.total - summary.healthy,
      availableModels: Array.from(summary.models),
      avgLatencyMs:
        nodes.length > 0
          ? Math.round(nodes.reduce((sum, n) => sum + n.latencyMs, 0) / nodes.length)
          : 0,
    });
  } catch (error) {
    console.error("Failed to fetch network health:", error);
    res.status(500).json({ error: "failed_to_fetch_health" });
  }
});

/**
 * GET /operators/:address
 * Get details for a specific operator by address
 */
operatorRouter.get("/:address", async (req, res) => {
  const operatorAddress = req.params.address;

  if (!operatorAddress || !operatorAddress.startsWith("0x")) {
    return res.status(400).json({ error: "invalid_address" });
  }

  try {
    const details = await subnetNodeService.getOperatorDetails(operatorAddress);

    if (!details) {
      return res.status(404).json({ error: "operator_not_found" });
    }

    // Get health data
    const node = ollamaService.getAllNodes().find((n) => n.address === operatorAddress);

    // Get current epoch stats
    const epochStats = await subnetNodeService.getCurrentEpochStats(operatorAddress);

    res.json({
      address: operatorAddress,
      ...details,
      isHealthy: node?.isHealthy ?? false,
      latencyMs: node?.latencyMs ?? 0,
      lastHealthCheck: node?.lastHealthCheck ?? null,
      currentEpoch: epochStats,
    });
  } catch (error) {
    console.error(`Failed to fetch operator ${operatorAddress}:`, error);
    res.status(500).json({ error: "failed_to_fetch_operator" });
  }
});

/**
 * GET /operators/:address/stats
 * Get detailed stats for an operator
 */
operatorRouter.get("/:address/stats", async (req, res) => {
  const operatorAddress = req.params.address;

  if (!operatorAddress || !operatorAddress.startsWith("0x")) {
    return res.status(400).json({ error: "invalid_address" });
  }

  try {
    // Get request logs from database
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [stats24h, stats7d, recentLogs] = await Promise.all([
      prisma.ollamaRequestLog.aggregate({
        where: {
          operatorAddress,
          createdAt: { gte: last24h },
        },
        _count: true,
        _sum: { latencyMs: true },
        _avg: { latencyMs: true },
      }),
      prisma.ollamaRequestLog.aggregate({
        where: {
          operatorAddress,
          createdAt: { gte: last7d },
        },
        _count: true,
        _sum: { inputTokens: true, outputTokens: true },
      }),
      prisma.ollamaRequestLog.findMany({
        where: { operatorAddress },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          model: true,
          latencyMs: true,
          success: true,
          createdAt: true,
        },
      }),
    ]);

    // Get on-chain stats
    const epochStats = await subnetNodeService.getCurrentEpochStats(operatorAddress);
    const pendingRewards = await subnetNodeService.getPendingRewards(operatorAddress);

    // Calculate success rate
    const successCount24h = await prisma.ollamaRequestLog.count({
      where: {
        operatorAddress,
        createdAt: { gte: last24h },
        success: true,
      },
    });

    res.json({
      address: operatorAddress,
      stats24h: {
        requests: stats24h._count,
        successRate:
          stats24h._count > 0
            ? ((successCount24h / stats24h._count) * 100).toFixed(1)
            : "0",
        avgLatencyMs: Math.round(stats24h._avg?.latencyMs ?? 0),
        totalLatencyMs: stats24h._sum?.latencyMs ?? 0,
      },
      stats7d: {
        requests: stats7d._count,
        totalInputTokens: stats7d._sum?.inputTokens ?? 0,
        totalOutputTokens: stats7d._sum?.outputTokens ?? 0,
      },
      currentEpoch: epochStats,
      pendingRewards,
      recentRequests: recentLogs,
    });
  } catch (error) {
    console.error(`Failed to fetch operator stats ${operatorAddress}:`, error);
    res.status(500).json({ error: "failed_to_fetch_stats" });
  }
});

/**
 * POST /operators/claim
 * Claim rewards for an operator (requires wallet auth)
 */
operatorRouter.post("/claim", checkAuth, async (req, res) => {
  const user = (req as any).user;
  const { epochs } = req.body;

  if (!user?.walletAddress) {
    return res.status(401).json({ error: "wallet_required" });
  }

  if (!Array.isArray(epochs) || epochs.length === 0) {
    return res.status(400).json({ error: "invalid_request" });
  }

  try {
    // Claims are done via the contract directly using the user's wallet
    res.json({
      message: "claim_via_contract",
      operatorAddress: user.walletAddress,
      epochs,
      contractAddress: process.env.SUBNET_REWARDS_ADDRESS,
      instructions:
        "Call claimMultipleEpochs(epochs) on the SubnetRewards contract",
    });
  } catch (error) {
    console.error("Failed to process claim:", error);
    res.status(500).json({ error: "claim_failed" });
  }
});

/**
 * GET /operators/my
 * Get operators owned by the authenticated user
 */
operatorRouter.get("/my", checkAuth, async (req, res) => {
  const user = (req as any).user;

  if (!user?.walletAddress) {
    return res.status(401).json({ error: "wallet_required" });
  }

  try {
    // Check if the user's wallet is a registered operator
    const details = await subnetNodeService.getOperatorDetails(user.walletAddress);

    res.json({
      operator: details || null,
      operatorAddress: user.walletAddress,
    });
  } catch (error) {
    console.error("Failed to fetch user operators:", error);
    res.status(500).json({ error: "failed_to_fetch_operators" });
  }
});
