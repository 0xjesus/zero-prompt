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

// Apply auth middleware to all routes
router.use(checkAuth);

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface RatingRequest {
  modelId: number;
  score: number;
  tag1?: string;
  tag2?: string;
  comment?: string;
}

interface Rating {
  score: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function updateReputationCache(modelId: number): Promise<void> {
  const ratings = await db.modelRating.findMany({
    where: { modelId },
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
// PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

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
      where: { modelId: model.id },
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
      })),
    });
  } catch (error: any) {
    console.error("[Reputation] Failed to get model:", error);
    res.status(500).json({ error: "Failed to fetch model reputation" });
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
router.post("/rate", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.walletAddress) {
      return res.status(401).json({ error: "Wallet authentication required to rate models" });
    }

    const { modelId, score, tag1, tag2, comment } = req.body as RatingRequest;

    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: "Score must be between 1 and 5" });
    }

    const model = await prisma.model.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      return res.status(404).json({ error: "Model not found" });
    }

    const existingRating = await db.modelRating.findUnique({
      where: {
        modelId_userId: {
          modelId,
          userId: user.id,
        },
      },
    });

    let rating;

    if (existingRating) {
      rating = await db.modelRating.update({
        where: { id: existingRating.id },
        data: {
          score,
          tag1: tag1 || null,
          tag2: tag2 || null,
          comment: comment || null,
          txHash: null,
          syncedAt: null,
        },
      });
    } else {
      rating = await db.modelRating.create({
        data: {
          modelId,
          userId: user.id,
          score,
          tag1: tag1 || null,
          tag2: tag2 || null,
          comment: comment || null,
        },
      });
    }

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
router.delete("/rate/:modelId", async (req: Request, res: Response) => {
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
router.get("/my-ratings", async (req: Request, res: Response) => {
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
router.get("/check/:modelId", async (req: Request, res: Response) => {
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

export default router;
