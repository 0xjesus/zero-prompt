import { Router } from 'express';
import { x402 } from '../middleware/x402';
import { getModels } from '../services/openrouter';
import { generateQuote, getAvaxPrice, getMinimumPaymentAVAX } from '../services/quote';

// OpenRouter config for image generation
const OPENROUTER_API_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export const agentRouter = Router();

// ============================================================================
// QUOTE ENDPOINT - Get accurate pricing before payment
// ============================================================================
agentRouter.post('/quote', async (req, res) => {
  try {
    const { model, prompt, maxOutputTokens, imageCount } = req.body;

    if (!model) {
      return res.status(400).json({ error: 'Model ID is required' });
    }
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const quote = await generateQuote({
      model,
      prompt,
      maxOutputTokens,
      imageCount
    });

    // Add minimum payment with buffer
    const minimumPaymentAVAX = getMinimumPaymentAVAX(quote.pricing.totalCostAVAX);

    res.json({
      ...quote,
      payment: {
        recommendedAVAX: minimumPaymentAVAX,
        minimumAVAX: Math.max(0.0001, quote.pricing.totalCostAVAX),
        currency: 'AVAX',
        network: 'Avalanche C-Chain',
        chainId: 43114
      }
    });
  } catch (error: any) {
    console.error('Quote generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate quote',
      details: error.message
    });
  }
});

// ============================================================================
// AVAX PRICE ENDPOINT - Get current AVAX price
// ============================================================================
agentRouter.get('/avax-price', async (_req, res) => {
  try {
    const price = await getAvaxPrice();
    res.json({
      success: true,
      price,
      currency: 'USD',
      source: 'CoinGecko',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('AVAX price fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AVAX price',
      details: error.message
    });
  }
});

// Get all available models from OpenRouter
agentRouter.get('/models', async (_req, res) => {
  try {
    const rawModels = await getModels();

    // Transform to a simpler format for the frontend
    const models = rawModels.map((m: any, index) => {
      const modality = m.architecture?.modality || 'text->text';
      const isImageGenerator = modality.includes('->image') ||
        m.id.includes('dall-e') ||
        m.id.includes('stable-diffusion') ||
        m.id.includes('midjourney') ||
        m.id.includes('flux') ||
        m.id.includes('imagen');

      // Parse modality to create input/output arrays for the frontend modal
      const inputModalities: string[] = ['text'];
      const outputModalities: string[] = ['text'];

      if (modality.includes('image->') || modality.includes('image+')) {
        inputModalities.push('image');
      }
      if (modality.includes('->image') || modality.includes('+image')) {
        outputModalities.push('image');
      }
      if (isImageGenerator) {
        if (!outputModalities.includes('image')) outputModalities.push('image');
      }

      return {
        id: String(index + 1),
        openrouterId: m.id,
        name: m.name,
        publicPricingPrompt: parseFloat(m.pricing?.prompt || '0'),
        publicPricingCompletion: parseFloat(m.pricing?.completion || '0'),
        publicPricingImage: parseFloat(m.pricing?.image || '0'),
        contextLength: m.context_length || 0,
        architecture: {
          modality,
          input_modalities: inputModalities,
          output_modalities: outputModalities,
          has_web_search: m.architecture?.has_web_search || false,
          is_reasoning: m.architecture?.is_reasoning || false,
          has_audio: m.architecture?.has_audio || false,
        }
      };
    });

    res.json({ models });
  } catch (error: any) {
    console.error('Failed to fetch models:', error);
    res.status(500).json({ error: 'Failed to fetch models', details: error.message });
  }
});

// A premium route specifically for AI Agents
// Cost: 0.01 USDC (10000 units)
agentRouter.get('/premium-data', 
  x402({
    price: "10000", 
    resourceId: "/agent/premium-data",
    description: "Premium Market Data for Agents"
  }),
  (req, res) => {
    // If we reached here, payment was verified by middleware
    const payer = (req as any).x402?.payer;
    
    res.json({
      data: "This is premium data reserved for paying agents.",
      timestamp: new Date().toISOString(),
      insight: "Buy low, sell high.",
      access_granted_to: payer
    });
  }
);

// Helper to detect image generation models
function isImageGenerationModel(modelId: string): boolean {
  const lowerModelId = modelId.toLowerCase();
  const imageModelPatterns = [
    'dall-e', 'stable-diffusion', 'flux', 'imagen', 'midjourney',
    'ideogram', 'recraft', 'playground', 'sdxl', 'kandinsky',
    '->image', 'image-generation',
    '-image',      // catches "gemini-2.5-flash-image"
    'image-gen',
    '/image',      // catches paths like "model/image-v1"
  ];

  // Also check if model name ends with "-image" or contains "image" as a word boundary
  const hasImageSuffix = lowerModelId.endsWith('-image') || lowerModelId.endsWith('/image');
  const hasImageWord = /[^a-z]image[^a-z]|[^a-z]image$|^image[^a-z]/i.test(modelId);

  return hasImageSuffix || hasImageWord ||
    imageModelPatterns.some(pattern => lowerModelId.includes(pattern));
}

// LLM/Image Generation route with proper image handling
agentRouter.post('/generate',
  x402({
    price: "50000", // 0.05 USDC
    resourceId: "/agent/generate",
    description: "Agent LLM/Image Generation Request"
  }),
  async (req, res) => {
    try {
      const { prompt, model } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: "OpenRouter API key not configured" });
      }

      const targetModel = model || "meta-llama/llama-3-8b-instruct:free";
      const isImageModel = isImageGenerationModel(targetModel);

      console.log(`[Agent Generate] Model: ${targetModel}, IsImage: ${isImageModel}`);

      // Build request payload - add special handling for image models
      const requestPayload: any = {
        model: targetModel,
        messages: [{ role: "user", content: prompt }]
      };

      // For image generation models, we might need to add modalities or other params
      if (isImageModel) {
        // Some models need explicit modalities configuration
        requestPayload.modalities = ["text", "image"];
        // For Gemini, might need response_format
        if (targetModel.includes('gemini')) {
          requestPayload.response_modalities = ["TEXT", "IMAGE"];
        }
      }

      console.log(`[Agent Generate] Request payload:`, JSON.stringify(requestPayload, null, 2));

      // Make direct OpenRouter API call to handle both text and image responses
      const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost',
          'X-Title': 'ZeroPrompt Agent API'
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Agent Generate] OpenRouter error: ${response.status}`, errorText);
        return res.status(response.status).json({
          error: "OpenRouter API error",
          details: errorText
        });
      }

      const data = await response.json();
      console.log(`[Agent Generate] Response received, parsing...`);
      console.log(`[Agent Generate] Full response structure:`, JSON.stringify(data, null, 2).substring(0, 2000));

      // Extract content from response
      const message = data.choices?.[0]?.message;
      const content = message?.content;

      console.log(`[Agent Generate] Message:`, JSON.stringify(message, null, 2)?.substring(0, 1000));
      console.log(`[Agent Generate] Content type:`, typeof content, Array.isArray(content) ? 'array' : '');

      // Initialize response object
      const result: any = {
        model: targetModel,
        usage: data.usage
      };

      // Parse images from various formats
      const generatedImages: string[] = [];

      // Format 1: Content is an array with image_url parts (GPT-4o, etc.)
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === 'image_url' && part.image_url?.url) {
            generatedImages.push(part.image_url.url);
          } else if (part.type === 'text') {
            result.result = (result.result || '') + part.text;
          }
        }
      }
      // Format 2: Content is a string
      else if (typeof content === 'string') {
        // Check if it's a direct image URL
        if (content.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)/i) ||
            content.startsWith('data:image/')) {
          generatedImages.push(content);
        } else {
          result.result = content;
        }
      }

      // Format 3: Gemini-style images array in delta
      if (message?.images && Array.isArray(message.images)) {
        for (const img of message.images) {
          const imgUrl = img.image_url?.url || img.url || img;
          if (typeof imgUrl === 'string') {
            generatedImages.push(imgUrl);
          }
        }
      }

      // Format 4: Direct image_url in message
      if (message?.image_url?.url) {
        generatedImages.push(message.image_url.url);
      }

      // Add images to result if found
      if (generatedImages.length > 0) {
        result.generatedImages = generatedImages;
        result.generatedImage = generatedImages[0]; // First image for backwards compat
        console.log(`[Agent Generate] Found ${generatedImages.length} image(s)`);
      }

      // If no text result and no images, something went wrong
      if (!result.result && generatedImages.length === 0) {
        result.result = "Response received but no content extracted";
        console.warn(`[Agent Generate] No content extracted from response:`, JSON.stringify(data).substring(0, 500));
      }

      res.json(result);

    } catch (error: any) {
      console.error("[Agent Generate] Error:", error);
      res.status(500).json({ error: "Failed to generate response", details: error.message });
    }
  }
);
