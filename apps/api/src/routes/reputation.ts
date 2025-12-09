/**
 * Model Reputation API Routes
 *
 * ERC-8004 compliant reputation system for AI models.
 * Stores ratings off-chain with optional blockchain sync.
 */

import { Router, Request, Response } from "express";
import { prisma } from "../prisma";
import { checkAuth } from "../middleware/auth";

const router = Router();

// Type-safe access to new Prisma models (before regeneration)
const db = prisma as any;

// NOTE: Auth middleware is applied selectively - public endpoints come first,
// then authenticated endpoints use checkAuth per-route

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface RatingRequest {
  modelId: number;
  score: number;
  tag1?: string;
  tag2?: string;
  comment?: string;
  txHash?: string;
}

interface Rating {
  score: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function updateReputationCache(modelId: number): Promise<void> {
  // Only count on-chain ratings for reputation
  const ratings = await db.modelRating.findMany({
    where: {
      modelId,
      txHash: { not: null }, // Only on-chain ratings
    },
    select: { score: true },
  });

  if (ratings.length === 0) {
    await db.modelReputationCache.deleteMany({ where: { modelId } });
    return;
  }

  const totalRatings = ratings.length;
  const sumScores = ratings.reduce((sum: number, r: Rating) => sum + r.score, 0);
  const averageScore = sumScores / totalRatings;

  const fiveStarCount = ratings.filter((r: Rating) => r.score === 5).length;
  const fourStarCount = ratings.filter((r: Rating) => r.score === 4).length;
  const threeStarCount = ratings.filter((r: Rating) => r.score === 3).length;
  const twoStarCount = ratings.filter((r: Rating) => r.score === 2).length;
  const oneStarCount = ratings.filter((r: Rating) => r.score === 1).length;

  await db.modelReputationCache.upsert({
    where: { modelId },
    update: {
      totalRatings,
      sumScores,
      averageScore,
      fiveStarCount,
      fourStarCount,
      threeStarCount,
      twoStarCount,
      oneStarCount,
    },
    create: {
      modelId,
      totalRatings,
      sumScores,
      averageScore,
      fiveStarCount,
      fourStarCount,
      threeStarCount,
      twoStarCount,
      oneStarCount,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TAG DEFINITIONS - LLM Capability Categories
// ═══════════════════════════════════════════════════════════════════════════

const AVAILABLE_TAGS = [
  // Task Capabilities
  { id: 'math', label: 'Math', emoji: '🧮', color: '#3B82F6', description: 'Good at mathematics and calculations' },
  { id: 'coding', label: 'Coding', emoji: '💻', color: '#10B981', description: 'Good at programming and code generation' },
  { id: 'reasoning', label: 'Reasoning', emoji: '🧠', color: '#8B5CF6', description: 'Good at complex reasoning and logic' },
  { id: 'creative', label: 'Creative', emoji: '🎨', color: '#EC4899', description: 'Good at creative writing and content' },
  { id: 'research', label: 'Research', emoji: '🔬', color: '#06B6D4', description: 'Good at analysis and research tasks' },
  // Behavior
  { id: 'uncensored', label: 'Uncensored', emoji: '🔓', color: '#EF4444', description: 'Minimal content restrictions' },
  { id: 'roleplay', label: 'Roleplay', emoji: '🎭', color: '#F97316', description: 'Good at character roleplay' },
  { id: 'multilingual', label: 'Multilingual', emoji: '🌍', color: '#14B8A6', description: 'Good at multiple languages' },
  // Technical
  { id: 'fast', label: 'Fast', emoji: '⚡', color: '#EAB308', description: 'Fast response times' },
  { id: 'accurate', label: 'Accurate', emoji: '🎯', color: '#22C55E', description: 'Highly accurate and factual' },
];

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /reputation/available-tags
 * Get the list of available tags for rating models
 */
router.get("/available-tags", async (_req: Request, res: Response) => {
  res.json({ tags: AVAILABLE_TAGS });
});

/**
 * GET /reputation/models
 * Get reputation data for all models
 */
router.get("/models", async (_req: Request, res: Response) => {
  try {
    const reputations = await db.modelReputationCache.findMany({
      include: {
        model: {
          select: {
            id: true,
            openrouterId: true,
            name: true,
          },
        },
      },
    });

    const reputationMap: Record<string, {
      totalRatings: number;
      averageScore: number;
      distribution: number[];
    }> = {};

    for (const rep of reputations) {
      reputationMap[rep.model.openrouterId] = {
        totalRatings: rep.totalRatings,
        averageScore: Number(rep.averageScore),
        distribution: [
          rep.oneStarCount,
          rep.twoStarCount,
          rep.threeStarCount,
          rep.fourStarCount,
          rep.fiveStarCount,
        ],
      };
    }

    res.json({ reputations: reputationMap });
  } catch (error: any) {
    console.error("[Reputation] Failed to get models:", error);
    res.status(500).json({ error: "Failed to fetch reputation data" });
  }
});

/**
 * GET /reputation/model/:openrouterId
 * Get detailed reputation for a specific model
 */
router.get("/model/:openrouterId", async (req: Request, res: Response) => {
  try {
    const { openrouterId } = req.params;
    const decodedId = decodeURIComponent(openrouterId);

    const model = await prisma.model.findUnique({
      where: { openrouterId: decodedId },
    });

    if (!model) {
      return res.status(404).json({ error: "Model not found" });
    }

    const cache = await db.modelReputationCache.findUnique({
      where: { modelId: model.id },
    });

    const recentRatings = await db.modelRating.findMany({
      where: {
        modelId: model.id,
        txHash: { not: null }, // Only show on-chain ratings
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            walletAddress: true,
            displayName: true,
          },
        },
      },
    });

    res.json({
      model: {
        id: model.id,
        openrouterId: model.openrouterId,
        name: model.name,
      },
      reputation: cache
        ? {
            totalRatings: cache.totalRatings,
            averageScore: Number(cache.averageScore),
            distribution: [
              cache.oneStarCount,
              cache.twoStarCount,
              cache.threeStarCount,
              cache.fourStarCount,
              cache.fiveStarCount,
            ],
          }
        : null,
      recentReviews: recentRatings.map((r: any) => ({
        score: r.score,
        tag1: r.tag1,
        tag2: r.tag2,
        comment: r.comment,
        createdAt: r.createdAt,
        reviewer: r.user.displayName || (r.user.walletAddress?.slice(0, 8) + "..."),
        txHash: r.txHash || null,
      })),
    });
  } catch (error: any) {
    console.error("[Reputation] Failed to get model:", error);
    res.status(500).json({ error: "Failed to fetch model reputation" });
  }
});

/**
 * GET /reputation/recent-activity
 * Get the most recent ratings with transaction data
 */
router.get("/recent-activity", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const recentRatings = await db.modelRating.findMany({
      where: {
        txHash: { not: null }, // Only show on-chain ratings
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            walletAddress: true,
            displayName: true,
          },
        },
        model: {
          select: {
            id: true,
            openrouterId: true,
            name: true,
            iconUrl: true,
          },
        },
      },
    });

    res.json({
      activity: recentRatings.map((r: any) => ({
        id: r.id,
        score: r.score,
        tag1: r.tag1,
        tag2: r.tag2,
        comment: r.comment,
        txHash: r.txHash || null,
        createdAt: r.createdAt,
        reviewer: r.user.displayName || (r.user.walletAddress?.slice(0, 8) + "..."),
        reviewerAddress: r.user.walletAddress,
        model: {
          id: r.model.id,
          openrouterId: r.model.openrouterId,
          name: r.model.name,
          iconUrl: r.model.iconUrl,
        },
      })),
    });
  } catch (error: any) {
    console.error("[Reputation] Failed to get recent activity:", error);
    res.status(500).json({ error: "Failed to fetch recent activity" });
  }
});

/**
 * GET /reputation/tags
 * Get available tags and models count per tag
 * Used for filtering models by capability in the selector
 */
router.get("/tags", async (_req: Request, res: Response) => {
  try {
    // Get all on-chain ratings with tags
    const ratingsWithTags = await db.modelRating.findMany({
      where: {
        txHash: { not: null }, // Only on-chain ratings
        OR: [
          { tag1: { not: null } },
          { tag2: { not: null } },
        ],
      },
      select: {
        modelId: true,
        tag1: true,
        tag2: true,
        score: true,
      },
    });

    // Count models per tag (all ratings count)
    const tagStats: Record<string, { count: number; modelIds: Set<number> }> = {};

    for (const rating of ratingsWithTags) {
      // Normalize tag to lowercase for consistent grouping
      if (rating.tag1) {
        const normalizedTag1 = rating.tag1.toLowerCase();
        if (!tagStats[normalizedTag1]) tagStats[normalizedTag1] = { count: 0, modelIds: new Set() };
        tagStats[normalizedTag1].modelIds.add(rating.modelId);
      }
      if (rating.tag2) {
        const normalizedTag2 = rating.tag2.toLowerCase();
        if (!tagStats[normalizedTag2]) tagStats[normalizedTag2] = { count: 0, modelIds: new Set() };
        tagStats[normalizedTag2].modelIds.add(rating.modelId);
      }
    }

    // Convert to response format
    const tags = Object.entries(tagStats).map(([tag, data]) => ({
      tag,
      modelCount: data.modelIds.size,
      modelIds: Array.from(data.modelIds),
    })).sort((a, b) => b.modelCount - a.modelCount);

    res.json({ tags });
  } catch (error: any) {
    console.error("[Reputation] Failed to get tags:", error);
    res.status(500).json({ error: "Failed to fetch tag statistics" });
  }
});

/**
 * GET /reputation/models-by-tag/:tag
 * Get models that have been rated with a specific tag
 * Shows all models with this tag, sorted by score (best first)
 */
router.get("/models-by-tag/:tag", async (req: Request, res: Response) => {
  try {
    const { tag } = req.params;
    const decodedTag = decodeURIComponent(tag).toLowerCase();

    // Find all on-chain ratings with this tag (MySQL is case-insensitive by default)
    const ratings = await db.modelRating.findMany({
      where: {
        txHash: { not: null }, // Only on-chain ratings
        OR: [
          { tag1: decodedTag },
          { tag2: decodedTag },
        ],
      },
      include: {
        model: {
          select: {
            id: true,
            openrouterId: true,
            name: true,
            iconUrl: true,
          },
        },
      },
    });

    // Group by model and count endorsements
    const modelMap: Record<number, { model: any; endorsementCount: number; avgScore: number; scores: number[] }> = {};

    for (const rating of ratings) {
      if (!modelMap[rating.modelId]) {
        modelMap[rating.modelId] = {
          model: rating.model,
          endorsementCount: 0,
          avgScore: 0,
          scores: [],
        };
      }
      modelMap[rating.modelId].endorsementCount++;
      modelMap[rating.modelId].scores.push(rating.score);
    }

    // Calculate average scores
    const models = Object.values(modelMap).map((data) => ({
      ...data.model,
      endorsementCount: data.endorsementCount,
      avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
    })).sort((a, b) => b.endorsementCount - a.endorsementCount || b.avgScore - a.avgScore);

    res.json({
      tag: decodedTag,
      models,
      totalModels: models.length,
    });
  } catch (error: any) {
    console.error("[Reputation] Failed to get models by tag:", error);
    res.status(500).json({ error: "Failed to fetch models by tag" });
  }
});

/**
 * GET /reputation/top
 * Get all models with their reputation data (sorted by score, then alphabetically)
 */
router.get("/top", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    // Get all active models with their reputation data (if any)
    const allModels = await db.model.findMany({
      where: { isActive: true },
      select: {
        id: true,
        openrouterId: true,
        name: true,
        iconUrl: true,
        reputationCache: {
          select: {
            totalRatings: true,
            averageScore: true,
            fiveStarCount: true,
            fourStarCount: true,
            threeStarCount: true,
            twoStarCount: true,
            oneStarCount: true,
          },
        },
      },
      take: limit,
    });

    // Sort: models with ratings first (by score desc), then unrated models alphabetically
    const sortedModels = allModels.sort((a: any, b: any) => {
      const aRatings = a.reputationCache?.totalRatings || 0;
      const bRatings = b.reputationCache?.totalRatings || 0;
      const aScore = a.reputationCache?.averageScore || 0;
      const bScore = b.reputationCache?.averageScore || 0;

      // Both have ratings - sort by score then by rating count
      if (aRatings > 0 && bRatings > 0) {
        if (bScore !== aScore) return bScore - aScore;
        return bRatings - aRatings;
      }
      // Only one has ratings - rated goes first
      if (aRatings > 0) return -1;
      if (bRatings > 0) return 1;
      // Neither has ratings - alphabetical
      return a.name.localeCompare(b.name);
    });

    res.json({
      models: sortedModels.map((model: any) => ({
        id: model.id,
        openrouterId: model.openrouterId,
        name: model.name,
        iconUrl: model.iconUrl,
        totalRatings: model.reputationCache?.totalRatings || 0,
        averageScore: Number(model.reputationCache?.averageScore || 0),
        distribution: model.reputationCache ? [
          model.reputationCache.oneStarCount,
          model.reputationCache.twoStarCount,
          model.reputationCache.threeStarCount,
          model.reputationCache.fourStarCount,
          model.reputationCache.fiveStarCount,
        ] : [0, 0, 0, 0, 0],
      })),
    });
  } catch (error: any) {
    console.error("[Reputation] Failed to get top models:", error);
    res.status(500).json({ error: "Failed to fetch top models" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATED ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /reputation/rate
 * Submit a rating for a model (requires authentication)
 */
router.post("/rate", checkAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.walletAddress) {
      return res.status(401).json({ error: "Wallet authentication required to rate models" });
    }

    const { modelId, score, tag1, tag2, comment, txHash } = req.body as RatingRequest;

    // Normalize tags to lowercase for consistent searching
    const normalizedTag1 = tag1?.toLowerCase() || null;
    const normalizedTag2 = tag2?.toLowerCase() || null;

    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: "Score must be between 1 and 5" });
    }

    // Require txHash for on-chain verification
    if (!txHash) {
      return res.status(400).json({ error: "Transaction hash required. Rating must be submitted on-chain first." });
    }

    const model = await prisma.model.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      return res.status(404).json({ error: "Model not found" });
    }

    // Check if user already rated this model - NO UPDATES ALLOWED
    const existingRating = await db.modelRating.findUnique({
      where: {
        modelId_userId: {
          modelId,
          userId: user.id,
        },
      },
    });

    if (existingRating) {
      return res.status(400).json({
        error: "You have already rated this model. Only one rating per wallet per model is allowed.",
        existingRating: {
          score: existingRating.score,
          txHash: existingRating.txHash,
          createdAt: existingRating.createdAt,
        }
      });
    }

    // Create new rating
    const rating = await db.modelRating.create({
      data: {
        modelId,
        userId: user.id,
        score,
        tag1: normalizedTag1,
        tag2: normalizedTag2,
        comment: comment || null,
        txHash,
        syncedAt: new Date(),
      },
    });

    await updateReputationCache(modelId);

    const cache = await db.modelReputationCache.findUnique({
      where: { modelId },
    });

    res.json({
      success: true,
      rating: {
        id: rating.id,
        score: rating.score,
        tag1: rating.tag1,
        tag2: rating.tag2,
        createdAt: rating.createdAt,
      },
      modelReputation: cache
        ? {
            totalRatings: cache.totalRatings,
            averageScore: Number(cache.averageScore),
          }
        : null,
    });
  } catch (error: any) {
    console.error("[Reputation] Failed to rate model:", error);
    res.status(500).json({ error: "Failed to submit rating" });
  }
});

/**
 * DELETE /reputation/rate/:modelId
 * Remove user's rating for a model
 */
router.delete("/rate/:modelId", checkAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.walletAddress) {
      return res.status(401).json({ error: "Wallet authentication required" });
    }

    const modelId = parseInt(req.params.modelId);

    const deleted = await db.modelRating.deleteMany({
      where: {
        modelId,
        userId: user.id,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: "Rating not found" });
    }

    await updateReputationCache(modelId);

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Reputation] Failed to delete rating:", error);
    res.status(500).json({ error: "Failed to delete rating" });
  }
});

/**
 * GET /reputation/my-ratings
 * Get all ratings by the current user
 */
router.get("/my-ratings", checkAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const ratings = await db.modelRating.findMany({
      where: { userId: user.id },
      include: {
        model: {
          select: {
            id: true,
            openrouterId: true,
            name: true,
            iconUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      ratings: ratings.map((r: any) => ({
        modelId: r.modelId,
        openrouterId: r.model.openrouterId,
        modelName: r.model.name,
        iconUrl: r.model.iconUrl,
        score: r.score,
        tag1: r.tag1,
        tag2: r.tag2,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("[Reputation] Failed to get user ratings:", error);
    res.status(500).json({ error: "Failed to fetch your ratings" });
  }
});

/**
 * GET /reputation/check/:modelId
 * Check if current user has rated a model
 */
router.get("/check/:modelId", checkAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const modelId = parseInt(req.params.modelId);

    if (!user) {
      return res.json({ hasRated: false, rating: null });
    }

    const rating = await db.modelRating.findUnique({
      where: {
        modelId_userId: {
          modelId,
          userId: user.id,
        },
      },
    });

    res.json({
      hasRated: !!rating,
      rating: rating
        ? {
            score: rating.score,
            tag1: rating.tag1,
            tag2: rating.tag2,
            comment: rating.comment,
            createdAt: rating.createdAt,
          }
        : null,
    });
  } catch (error: any) {
    console.error("[Reputation] Failed to check rating:", error);
    res.status(500).json({ error: "Failed to check rating status" });
  }
});

/**
 * DELETE /reputation/cleanup-offchain
 * Remove all ratings that don't have a transaction hash (not on-chain)
 * This is an admin operation to clean up test data
 */
router.delete("/cleanup-offchain", checkAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.walletAddress) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get all ratings without txHash
    const offchainRatings = await db.modelRating.findMany({
      where: { txHash: null },
      select: { id: true, modelId: true },
    });

    if (offchainRatings.length === 0) {
      return res.json({ success: true, deleted: 0, message: "No off-chain ratings to delete" });
    }

    // Get unique model IDs to update caches
    const modelIdSet = new Set<number>();
    for (const r of offchainRatings) {
      modelIdSet.add(r.modelId);
    }
    const affectedModelIds = Array.from(modelIdSet);

    // Delete all ratings without txHash
    const deleted = await db.modelRating.deleteMany({
      where: { txHash: null },
    });

    // Update reputation caches for affected models
    for (const modelId of affectedModelIds) {
      await updateReputationCache(modelId);
    }

    console.log(`[Reputation] Cleanup: Deleted ${deleted.count} off-chain ratings from ${affectedModelIds.length} models`);

    res.json({
      success: true,
      deleted: deleted.count,
      affectedModels: affectedModelIds.length,
      message: `Deleted ${deleted.count} ratings without on-chain transaction`,
    });
  } catch (error: any) {
    console.error("[Reputation] Failed to cleanup off-chain ratings:", error);
    res.status(500).json({ error: "Failed to cleanup ratings" });
  }
});

export default router;
