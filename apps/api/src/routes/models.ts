import { Router } from "express";
import { prisma } from "../prisma";
import { syncOpenRouterModels } from "../services/openrouterModels";

export const modelsRouter = Router();

modelsRouter.get("/", async (_req, res) => {
  const models = await prisma.model.findMany({
    where: { isActive: true },
    orderBy: [{ displayPriority: "desc" }, { name: "asc" }],
  });

  // Try to get reputation data (gracefully handle if tables don't exist yet)
  let reputationMap: Record<number, { totalRatings: number; averageScore: number }> = {};
  try {
    const reputations = await (prisma as any).modelReputationCache?.findMany?.({
      select: {
        modelId: true,
        totalRatings: true,
        averageScore: true,
      },
    });
    if (reputations) {
      for (const rep of reputations) {
        reputationMap[rep.modelId] = {
          totalRatings: rep.totalRatings,
          averageScore: Number(rep.averageScore),
        };
      }
    }
  } catch {
    // Reputation tables not yet migrated, continue without reputation data
  }

  // Transform to include reputation
  const modelsWithReputation = models.map((model) => ({
    ...model,
    reputation: reputationMap[model.id] || null,
  }));

  res.json({ models: modelsWithReputation });
});

modelsRouter.post("/sync", async (_req, res) => {
  try {
    const result = await syncOpenRouterModels();
    res.json({ synced: result });
  } catch (error) {
    console.error("manual model sync error", error);
    res.status(500).json({ error: "sync_failed" });
  }
});

// Get recently added models (for admin panel notification)
modelsRouter.get("/new", async (req, res) => {
  const days = parseInt(req.query.days as string) || 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const newModels = await prisma.model.findMany({
    where: {
      createdAt: { gte: since },
      isActive: true
    },
    orderBy: { createdAt: "desc" }
  });

  res.json({
    count: newModels.length,
    since: since.toISOString(),
    models: newModels
  });
});

// Get model sync stats and recent activity
modelsRouter.get("/admin/stats", async (_req, res) => {
  const [totalActive, totalInactive, newToday, newThisWeek, allActiveModels] = await Promise.all([
    prisma.model.count({ where: { isActive: true } }),
    prisma.model.count({ where: { isActive: false } }),
    prisma.model.count({
      where: {
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        isActive: true
      }
    }),
    prisma.model.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        isActive: true
      }
    }),
    prisma.model.findMany({
      where: { isActive: true },
      select: { architecture: true }
    })
  ]);

  // Count categories from architecture JSON field
  let imageGenerators = 0;
  let visionModels = 0;
  let reasoningModels = 0;
  let webSearchModels = 0;

  for (const model of allActiveModels) {
    const arch = model.architecture as Record<string, unknown> | null;
    if (!arch) continue;

    const outputMods = arch.output_modalities as string[] | undefined;
    const inputMods = arch.input_modalities as string[] | undefined;

    if (outputMods?.includes("image")) imageGenerators++;
    if (inputMods?.includes("image")) visionModels++;
    if (arch.is_reasoning === true) reasoningModels++;
    if (arch.has_web_search === true) webSearchModels++;
  }

  res.json({
    totalActive,
    totalInactive,
    newToday,
    newThisWeek,
    categories: {
      imageGenerators,
      visionModels,
      reasoningModels,
      webSearchModels
    }
  });
});

// Get all models for admin (including inactive)
modelsRouter.get("/admin/all", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const search = (req.query.search as string) || "";
  const showNew = req.query.new === "true";
  const showInactive = req.query.inactive === "true";

  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { openrouterId: { contains: search, mode: "insensitive" } }
    ];
  }

  if (showNew) {
    where.createdAt = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  }

  if (!showInactive) {
    where.isActive = true;
  }

  const [models, total] = await Promise.all([
    prisma.model.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.model.count({ where })
  ]);

  res.json({
    models,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

modelsRouter.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, description, iconUrl, publicPricingPrompt, publicPricingCompletion, displayPriority, isActive } = req.body;

  try {
    const updated = await prisma.model.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        iconUrl,
        publicPricingPrompt: publicPricingPrompt ? parseFloat(publicPricingPrompt) : undefined,
        publicPricingCompletion: publicPricingCompletion ? parseFloat(publicPricingCompletion) : undefined,
        displayPriority: displayPriority ? parseInt(displayPriority) : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      }
    });
    res.json({ model: updated });
  } catch (error) {
    console.error("update model error", error);
    res.status(500).json({ error: "update_failed" });
  }
});
