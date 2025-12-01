/**
 * Quote Service - Accurate pricing estimation for AI requests
 *
 * Handles:
 * - Real-time AVAX price from CoinGecko
 * - Accurate token counting using gpt-tokenizer
 * - REAL-TIME pricing from OpenRouter API (not cached DB)
 * - Image generation model pricing
 * - Text model pricing (input + output)
 */

import { encode } from 'gpt-tokenizer';

// OpenRouter API for real-time pricing
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

// Cache AVAX price for 30 seconds to avoid rate limiting
let avaxPriceCache: { price: number; timestamp: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds

// ============================================================================
// AVAX PRICE - Real-time from CoinGecko
// ============================================================================
export async function getAvaxPrice(): Promise<number> {
  // Check cache first
  if (avaxPriceCache && Date.now() - avaxPriceCache.timestamp < CACHE_TTL) {
    return avaxPriceCache.price;
  }

  try {
    // Primary: CoinGecko simple price API
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd',
      { headers: { 'Accept': 'application/json' } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data['avalanche-2']?.usd) {
        const price = data['avalanche-2'].usd;
        avaxPriceCache = { price, timestamp: Date.now() };
        return price;
      }
    }

    // Fallback: CoinGecko coin details API
    const fallbackResponse = await fetch(
      'https://api.coingecko.com/api/v3/coins/avalanche-2?localization=false&tickers=false&community_data=false&developer_data=false',
      { headers: { 'Accept': 'application/json' } }
    );

    if (fallbackResponse.ok) {
      const data = await fallbackResponse.json();
      if (data.market_data?.current_price?.usd) {
        const price = data.market_data.current_price.usd;
        avaxPriceCache = { price, timestamp: Date.now() };
        return price;
      }
    }

    throw new Error('Failed to fetch AVAX price from all sources');
  } catch (error) {
    console.error('AVAX price fetch error:', error);
    // If we have stale cache, use it as last resort
    if (avaxPriceCache) {
      console.warn('Using stale AVAX price cache');
      return avaxPriceCache.price;
    }
    throw error;
  }
}

// ============================================================================
// TOKEN COUNTING - Using GPT tokenizer (accurate for most models)
// ============================================================================
export function countTokens(text: string): number {
  try {
    const tokens = encode(text);
    return tokens.length;
  } catch (error) {
    // Fallback to character-based estimation if tokenizer fails
    console.warn('Tokenizer failed, using fallback estimation');
    return Math.ceil(text.length / 4);
  }
}

// ============================================================================
// MODEL INFO - Get pricing DIRECTLY from OpenRouter API (real-time)
// ============================================================================

// Cache OpenRouter models for 5 minutes (prices don't change that often)
let openRouterModelsCache: { models: any[]; timestamp: number } | null = null;
const MODELS_CACHE_TTL = 300000; // 5 minutes

export interface ModelPricing {
  modelId: string;
  name: string;
  isImageModel: boolean;
  // Prices are PER TOKEN (not per million) - OpenRouter format
  inputPricePerToken: number;    // USD per input token
  outputPricePerToken: number;   // USD per output token
  imagePricePerUnit: number;     // USD per image generated
  modality: string;
  source: 'openrouter'; // Always from OpenRouter for verification
}

async function fetchOpenRouterModels(): Promise<any[]> {
  // Check cache
  if (openRouterModelsCache && Date.now() - openRouterModelsCache.timestamp < MODELS_CACHE_TTL) {
    return openRouterModelsCache.models;
  }

  try {
    const response = await fetch(`${OPENROUTER_API_URL}/models`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data || [];

    // Cache the results
    openRouterModelsCache = { models, timestamp: Date.now() };
    return models;
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error);
    // Return cached data if available (even if stale)
    if (openRouterModelsCache) {
      console.warn('Using stale OpenRouter models cache');
      return openRouterModelsCache.models;
    }
    throw error;
  }
}

export async function getModelPricing(openrouterId: string): Promise<ModelPricing | null> {
  try {
    const models = await fetchOpenRouterModels();
    const model = models.find((m: any) => m.id === openrouterId);

    if (!model) {
      console.warn(`Model not found in OpenRouter: ${openrouterId}`);
      return null;
    }

    const modality = model.architecture?.modality || 'text->text';

    // Detect image generation models
    const lowerModelId = openrouterId.toLowerCase();
    const hasImageSuffix = lowerModelId.endsWith('-image') || lowerModelId.endsWith('/image');
    const hasImageWord = /[^a-z]image[^a-z]|[^a-z]image$|^image[^a-z]/i.test(openrouterId);

    const isImageModel = modality.includes('->image') ||
      hasImageSuffix ||
      hasImageWord ||
      lowerModelId.includes('dall-e') ||
      lowerModelId.includes('stable-diffusion') ||
      lowerModelId.includes('flux') ||
      lowerModelId.includes('imagen') ||
      lowerModelId.includes('midjourney') ||
      lowerModelId.includes('ideogram') ||
      lowerModelId.includes('recraft') ||
      lowerModelId.includes('-image') ||
      lowerModelId.includes('image-gen');

    // OpenRouter pricing is PER TOKEN (not per million)
    // e.g., "0.000005" means $0.000005 per token
    const inputPricePerToken = parseFloat(model.pricing?.prompt || '0');
    const outputPricePerToken = parseFloat(model.pricing?.completion || '0');
    const imagePricePerUnit = parseFloat(model.pricing?.image || '0');

    return {
      modelId: model.id,
      name: model.name,
      isImageModel,
      inputPricePerToken,
      outputPricePerToken,
      imagePricePerUnit: isImageModel && imagePricePerUnit === 0 ? 0.02 : imagePricePerUnit,
      modality,
      source: 'openrouter'
    };
  } catch (error) {
    console.error('Failed to get model pricing from OpenRouter:', error);
    return null;
  }
}

// ============================================================================
// QUOTE CALCULATION
// ============================================================================
export interface QuoteRequest {
  model: string;           // OpenRouter model ID
  prompt: string;          // User's prompt
  maxOutputTokens?: number; // Optional max output tokens (default: estimate)
  imageCount?: number;     // For image models: number of images to generate
}

export interface QuoteResponse {
  success: boolean;
  model: {
    id: string;
    name: string;
    type: 'text' | 'image';
    modality: string;
  };
  tokens?: {
    input: number;
    estimatedOutput: number;
    total: number;
  };
  images?: {
    count: number;
    pricePerImage: number;
  };
  pricing: {
    inputCostUSD: number;
    outputCostUSD: number;
    totalCostUSD: number;
    avaxPrice: number;
    totalCostAVAX: number;
    // Raw prices from OpenRouter for verification
    inputPricePerToken?: number;
    outputPricePerToken?: number;
  };
  breakdown: string;
  timestamp: string;
  source?: 'openrouter'; // Indicates pricing source
}

export async function generateQuote(request: QuoteRequest): Promise<QuoteResponse> {
  // 1. Get model pricing
  const modelPricing = await getModelPricing(request.model);
  if (!modelPricing) {
    throw new Error(`Model not found: ${request.model}`);
  }

  // 2. Get current AVAX price
  const avaxPrice = await getAvaxPrice();

  // 3. Calculate based on model type
  if (modelPricing.isImageModel) {
    // IMAGE MODEL QUOTE
    const imageCount = request.imageCount || 1;
    const totalCostUSD = modelPricing.imagePricePerUnit * imageCount;
    const totalCostAVAX = totalCostUSD / avaxPrice;

    return {
      success: true,
      model: {
        id: modelPricing.modelId,
        name: modelPricing.name,
        type: 'image',
        modality: modelPricing.modality
      },
      images: {
        count: imageCount,
        pricePerImage: modelPricing.imagePricePerUnit
      },
      pricing: {
        inputCostUSD: 0,
        outputCostUSD: totalCostUSD,
        totalCostUSD,
        avaxPrice,
        totalCostAVAX
      },
      breakdown: `${imageCount} image(s) × $${modelPricing.imagePricePerUnit.toFixed(4)}/image = $${totalCostUSD.toFixed(6)}`,
      timestamp: new Date().toISOString()
    };
  } else {
    // TEXT MODEL QUOTE
    // Count input tokens accurately using gpt-tokenizer
    const inputTokens = countTokens(request.prompt);

    // Estimate output tokens (if not specified)
    // Heuristic: responses are typically 1.5-3x input length, capped at reasonable limits
    const estimatedOutputTokens = request.maxOutputTokens ||
      Math.min(Math.max(Math.ceil(inputTokens * 2), 150), 4000);

    const totalTokens = inputTokens + estimatedOutputTokens;

    // Calculate costs - OpenRouter prices are PER TOKEN (not per million)
    // e.g., prompt: "0.000005" = $0.000005 per token
    const inputCostUSD = inputTokens * modelPricing.inputPricePerToken;
    const outputCostUSD = estimatedOutputTokens * modelPricing.outputPricePerToken;
    const totalCostUSD = inputCostUSD + outputCostUSD;
    const totalCostAVAX = totalCostUSD / avaxPrice;

    return {
      success: true,
      model: {
        id: modelPricing.modelId,
        name: modelPricing.name,
        type: 'text',
        modality: modelPricing.modality
      },
      tokens: {
        input: inputTokens,
        estimatedOutput: estimatedOutputTokens,
        total: totalTokens
      },
      pricing: {
        inputCostUSD,
        outputCostUSD,
        totalCostUSD,
        avaxPrice,
        totalCostAVAX,
        // Include raw prices for verification
        inputPricePerToken: modelPricing.inputPricePerToken,
        outputPricePerToken: modelPricing.outputPricePerToken
      },
      breakdown: `${inputTokens} input × $${modelPricing.inputPricePerToken} + ~${estimatedOutputTokens} output × $${modelPricing.outputPricePerToken}`,
      timestamp: new Date().toISOString(),
      source: 'openrouter' // Indicates prices are from OpenRouter API
    };
  }
}

// ============================================================================
// MINIMUM PAYMENT - Ensure transaction goes through
// ============================================================================
export function getMinimumPaymentAVAX(quotedAVAX: number): number {
  // Minimum 0.0001 AVAX to ensure tx is processed
  // Add 5% buffer for price fluctuation during tx
  const withBuffer = quotedAVAX * 1.05;
  return Math.max(0.0001, withBuffer);
}
