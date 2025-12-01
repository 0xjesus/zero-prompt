import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
    web_search?: string | number;
    internal_reasoning?: string | number;
    audio?: string | number;
  };
  architecture?: any;
  tags?: unknown;
  supported_parameters?: string[];
};

const baseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const apiKey = process.env.OPENROUTER_API_KEY;

const parsePrice = (value: string | number | undefined | null): number | null => {
  if (value === undefined || value === null) return null;
  const num = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(num) ? num : null;
};

const applyMarkup = (value: number | null, factor = 1.7): number | null => {
  if (value === null) return null;
  return parseFloat((value * factor).toFixed(8));
};

const asJson = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined => {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
};

export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY missing");
  }

  const res = await fetch(`${baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch OpenRouter models: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { data?: OpenRouterModel[] };
  return data.data || [];
}

export async function syncOpenRouterModels() {
  const models = await fetchOpenRouterModels();
  const seenIds: string[] = [];
  let upserted = 0;
  const newModels: string[] = [];

  // Get existing model IDs to detect new ones
  const existingModels = await prisma.model.findMany({
    select: { openrouterId: true }
  });
  const existingIds = new Set(existingModels.map(m => m.openrouterId));

  for (const model of models) {
    // Track if this is a new model
    const isNew = !existingIds.has(model.id);
    const promptPrice = parsePrice(model.pricing?.prompt);
    const completionPrice = parsePrice(model.pricing?.completion);
    const publicPromptPrice = applyMarkup(promptPrice);
    const publicCompletionPrice = applyMarkup(completionPrice);

    // Enhance architecture with capabilities derived from pricing
    // IMPORTANT: Preserve original architecture fields from OpenRouter including:
    // - input_modalities (e.g., ['text', 'image'] for vision models)
    // - output_modalities (e.g., ['text', 'image'] for image generation models)
    // - modality (legacy field)
    let arch = model.architecture || {};

    // Web Search: Robust Detection
    // 1. Check for known search-specific model families or suffixes
    // 2. Check for explicit support via 'supported_parameters' (OpenRouter signal)
    const isExplicitlyWebSearch =
        model.id.includes("sonar") ||
        model.id.endsWith(":online") ||
        model.id.includes("-online") ||
        model.supported_parameters?.includes("web_search_options");

    if (isExplicitlyWebSearch) {
        arch = { ...arch, has_web_search: true };
    } else {
        // Ensure it's false if not explicitly a web search model
        arch = { ...arch, has_web_search: false };
    }

    // Reasoning - detect from pricing or model ID patterns
    if (
        (model.pricing?.internal_reasoning && parseFloat(String(model.pricing.internal_reasoning)) >= 0) ||
        model.id.includes("o1-") ||
        model.id.includes("-r1") ||
        model.id.includes("thinking")
    ) {
        arch = { ...arch, is_reasoning: true };
    }

    // Audio
    if (model.pricing?.audio && parseFloat(String(model.pricing.audio)) >= 0) {
        arch = { ...arch, has_audio: true };
    }

    // Image Generation - detect from output_modalities or model ID patterns
    // OpenRouter has many image generation models - detect them all
    const canGenerateImages =
        arch.output_modalities?.includes('image') ||
        model.id.includes('dall-e') ||
        model.id.includes('flux') ||
        model.id.includes('stable-diffusion') ||
        model.id.includes('midjourney') ||
        model.id.includes('ideogram') ||
        model.id.includes('imagen') ||
        model.id.includes('recraft') ||
        model.id.includes('playground') ||
        model.id.includes('sdxl') ||
        model.id.includes('kandinsky') ||
        model.id.includes('sana') ||
        model.id.includes('stable-cascade') ||
        model.id.includes('image-gen') ||
        model.id.includes('leonardo') ||
        model.id.includes('fooocus');

    if (canGenerateImages && !arch.output_modalities?.includes('image')) {
        arch = {
            ...arch,
            output_modalities: [...(arch.output_modalities || ['text']), 'image']
        };
    }

    await prisma.model.upsert({
      where: { openrouterId: model.id },
      update: {
        name: model.name,
        description: model.description,
        contextLength: model.context_length || null,
        pricingPrompt: promptPrice,
        pricingCompletion: completionPrice,
        publicPricingPrompt: publicPromptPrice,
        publicPricingCompletion: publicCompletionPrice,
        architecture: asJson(arch),
        tags: asJson(model.tags),
        isActive: true,
        lastSeenAt: new Date()
      },
      create: {
        openrouterId: model.id,
        name: model.name,
        description: model.description,
        contextLength: model.context_length || null,
        pricingPrompt: promptPrice,
        pricingCompletion: completionPrice,
        publicPricingPrompt: publicPromptPrice,
        publicPricingCompletion: publicCompletionPrice,
        architecture: asJson(arch),
        tags: asJson(model.tags),
        isActive: true,
        lastSeenAt: new Date()
      }
    });

    seenIds.push(model.id);
    upserted += 1;

    // Track new models
    if (isNew) {
      newModels.push(model.id);
    }
  }

  const deactivated = await prisma.model.updateMany({
    where: { openrouterId: { notIn: seenIds } },
    data: { isActive: false }
  });

  // Log new models for visibility
  if (newModels.length > 0) {
    console.log(`[model-sync] 🆕 ${newModels.length} NEW MODELS DETECTED:`, newModels);
  }

  return {
    upserted,
    deactivated: deactivated.count,
    newModels: newModels.length,
    newModelIds: newModels
  };
}