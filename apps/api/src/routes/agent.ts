import { Router } from 'express';
import { x402Middleware } from '../middleware/x402';
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

// Get supported payment methods (x402 EIP-3009 multi-chain USDC)
agentRouter.get('/payment-methods', (_req, res) => {
  const MERCHANT_ADDRESS = process.env.X402_MERCHANT_ADDRESS || '0x209F0baCA0c23edc57881B26B68FC4148123B039';

  // Supported chains for USDC payments with gas sponsorship
  const supportedChains = {
    avalanche: { chainId: 43114, usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
    base: { chainId: 8453, usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    arbitrum: { chainId: 42161, usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
    polygon: { chainId: 137, usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
    ethereum: { chainId: 1, usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    optimism: { chainId: 10, usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
  };

  res.json({
    success: true,
    scheme: "x402-eip3009",
    merchantAddress: MERCHANT_ADDRESS,
    token: "USDC",
    gasSponsored: true,
    supportedChains,
    hint: "Pay with USDC on any supported chain. Server pays gas via EIP-3009!",
  });
});

// A premium route specifically for AI Agents
// Cost: $0.01 USD (USDC on 170+ chains with gas sponsorship)
agentRouter.get('/premium-data',
  x402Middleware({
    price: "0.01",
    resourceId: "/agent/premium-data",
    description: "Premium Market Data for Agents"
  }),
  (req, res) => {
    // If we reached here, payment was verified by middleware
    const x402Info = (req as any).x402;

    res.json({
      data: "This is premium data reserved for paying agents.",
      timestamp: new Date().toISOString(),
      insight: "Buy low, sell high.",
      access_granted_to: x402Info?.payer,
      payment: {
        amount: x402Info?.amount,
        currency: x402Info?.currency,
        network: x402Info?.network,
      }
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
// Cost: $0.05 USD (USDC on 170+ chains with gas sponsorship)
agentRouter.post('/generate',
  x402Middleware({
    price: "0.05",
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

// ============================================================================
// MODEL BATTLE - Compare multiple models side by side
// Cost: $0.10 USD (covers up to 4 models)
// ============================================================================
agentRouter.post('/battle',
  x402Middleware({
    price: "0.10",
    resourceId: "/agent/battle",
    description: "Model Battle - Compare Multiple LLMs"
  }),
  async (req, res) => {
    try {
      const { prompt, models } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      if (!models || !Array.isArray(models) || models.length < 2) {
        return res.status(400).json({ error: "At least 2 models required for battle" });
      }
      if (models.length > 4) {
        return res.status(400).json({ error: "Maximum 4 models per battle" });
      }

      console.log(`[Battle] Starting battle with ${models.length} models`);

      // Execute all models in parallel
      const startTime = Date.now();
      const results = await Promise.allSettled(
        models.map(async (modelId: string) => {
          const modelStart = Date.now();
          const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'HTTP-Referer': process.env.APP_URL || 'http://localhost',
              'X-Title': 'ZeroPrompt Battle'
            },
            body: JSON.stringify({
              model: modelId,
              messages: [{ role: "user", content: prompt }],
              max_tokens: 1000
            })
          });

          if (!response.ok) {
            throw new Error(`Model ${modelId} failed: ${response.status}`);
          }

          const data = await response.json();
          return {
            model: modelId,
            response: data.choices?.[0]?.message?.content || 'No response',
            usage: data.usage,
            latency: Date.now() - modelStart
          };
        })
      );

      const totalTime = Date.now() - startTime;

      // Format results
      const battleResults = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            model: models[index],
            response: `Error: ${result.reason?.message || 'Unknown error'}`,
            error: true,
            latency: 0
          };
        }
      });

      console.log(`[Battle] Completed in ${totalTime}ms`);

      res.json({
        success: true,
        prompt,
        results: battleResults,
        totalLatency: totalTime,
        modelsCompared: models.length,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("[Battle] Error:", error);
      res.status(500).json({ error: "Battle failed", details: error.message });
    }
  }
);

// ============================================================================
// AI CONSENSUS - 3 models vote, show agreement
// Cost: $0.08 USD
// ============================================================================
agentRouter.post('/consensus',
  x402Middleware({
    price: "0.08",
    resourceId: "/agent/consensus",
    description: "AI Consensus - Multiple Models Vote"
  }),
  async (req, res) => {
    try {
      const { prompt, models, judge } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      if (!models || !Array.isArray(models) || models.length < 2) {
        return res.status(400).json({ error: "At least 2 models are required for consensus" });
      }

      if (models.length > 5) {
        return res.status(400).json({ error: "Maximum 5 models allowed" });
      }

      if (!judge || typeof judge !== 'string') {
        return res.status(400).json({ error: "Judge model is required" });
      }

      // Use models from request (selected by user via ModelSelectorModal)
      const consensusModels = models;
      const judgeModel = judge;

      // Enhanced prompt for structured response
      const consensusPrompt = `Answer this question concisely and directly. Be specific.

Question: ${prompt}

Provide a clear, direct answer in 2-3 sentences maximum.`;

      console.log(`[Consensus] Starting with ${consensusModels.length} models: ${consensusModels.join(', ')}, judge: ${judgeModel}`);

      const startTime = Date.now();
      const results = await Promise.allSettled(
        consensusModels.map(async (modelId) => {
          const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'HTTP-Referer': process.env.APP_URL || 'http://localhost',
              'X-Title': 'ZeroPrompt Consensus'
            },
            body: JSON.stringify({
              model: modelId,
              messages: [{ role: "user", content: consensusPrompt }],
              max_tokens: 500,
              temperature: 0.3 // Lower temperature for more consistent answers
            })
          });

          if (!response.ok) {
            throw new Error(`Model ${modelId} failed`);
          }

          const data = await response.json();
          return {
            model: modelId,
            response: data.choices?.[0]?.message?.content || 'No response',
            usage: data.usage
          };
        })
      );

      // Extract successful responses
      const successfulResults = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);

      // Simple consensus analysis using a 4th model call
      let consensusAnalysis = null;
      if (successfulResults.length >= 2) {
        const analysisPrompt = `Analyze these ${successfulResults.length} AI responses to the question: "${prompt}"

${successfulResults.map((r, i) => `Model ${i + 1} (${r.model.split('/')[1]}): ${r.response}`).join('\n\n')}

Provide:
1. AGREEMENT LEVEL: High/Medium/Low
2. CONSENSUS ANSWER: The main point they agree on (1 sentence)
3. KEY DIFFERENCES: Any notable disagreements (1 sentence, or "None" if they agree)`;

        try {
          console.log(`[Consensus] Using judge model: ${judgeModel}`);
          const analysisResponse = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'HTTP-Referer': process.env.APP_URL || 'http://localhost',
              'X-Title': 'ZeroPrompt Consensus Analysis'
            },
            body: JSON.stringify({
              model: judgeModel,
              messages: [{ role: "user", content: analysisPrompt }],
              max_tokens: 300
            })
          });

          if (analysisResponse.ok) {
            const analysisData = await analysisResponse.json();
            consensusAnalysis = analysisData.choices?.[0]?.message?.content;
          }
        } catch (e) {
          console.warn('[Consensus] Analysis failed:', e);
        }
      }

      const totalTime = Date.now() - startTime;

      res.json({
        success: true,
        prompt,
        models: consensusModels,
        judgeModel,
        responses: successfulResults,
        failedModels: results.filter(r => r.status === 'rejected').length,
        consensus: consensusAnalysis,
        totalLatency: totalTime,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("[Consensus] Error:", error);
      res.status(500).json({ error: "Consensus failed", details: error.message });
    }
  }
);

// ============================================================================
// IMAGE GALLERY - Generate with multiple image models
// Cost: $0.15 USD (covers 3 image models)
// ============================================================================
agentRouter.post('/image-gallery',
  x402Middleware({
    price: "0.15",
    resourceId: "/agent/image-gallery",
    description: "Image Gallery - Multiple AI Art Models"
  }),
  async (req, res) => {
    try {
      const { prompt, models } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      if (!models || !Array.isArray(models) || models.length < 1) {
        return res.status(400).json({ error: "At least 1 image model is required" });
      }

      if (models.length > 4) {
        return res.status(400).json({ error: "Maximum 4 models allowed" });
      }

      // Use models from request (selected by user via ModelSelectorModal)
      const imageModels = models;

      console.log(`[ImageGallery] Generating with ${imageModels.length} models: ${imageModels.join(', ')}`);

      const startTime = Date.now();
      const results = await Promise.allSettled(
        imageModels.map(async (modelId) => {
          const modelStart = Date.now();

          const requestPayload: any = {
            model: modelId,
            messages: [{ role: "user", content: prompt }]
          };

          // Add modalities for models that need it
          if (modelId.includes('flux') || modelId.includes('stable')) {
            requestPayload.modalities = ["image"];
          }

          const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'HTTP-Referer': process.env.APP_URL || 'http://localhost',
              'X-Title': 'ZeroPrompt Gallery'
            },
            body: JSON.stringify(requestPayload)
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`${modelId}: ${response.status} - ${errorText}`);
          }

          const data = await response.json();

          // Log full response for debugging
          console.log(`[ImageGallery] ${modelId} response:`, JSON.stringify(data, null, 2).slice(0, 500));

          const message = data.choices?.[0]?.message;
          const content = message?.content;

          // Extract image URL from various formats
          let imageUrl = null;

          // Format 1: content is array with image_url object
          if (Array.isArray(content)) {
            const imgPart = content.find((p: any) => p.type === 'image_url');
            if (imgPart?.image_url?.url) {
              imageUrl = imgPart.image_url.url;
            }
            // Also check for direct url in array items
            const urlPart = content.find((p: any) => p.url || p.image);
            if (!imageUrl && urlPart) {
              imageUrl = urlPart.url || urlPart.image;
            }
          }
          // Format 2: content is a direct URL string
          else if (typeof content === 'string') {
            if (content.match(/^https?:\/\//) || content.startsWith('data:image/')) {
              imageUrl = content;
            }
          }

          // Format 3: image_url at message level
          if (!imageUrl && message?.image_url?.url) {
            imageUrl = message.image_url.url;
          }

          // Format 4: data.data array (DALL-E style)
          if (!imageUrl && data.data?.[0]?.url) {
            imageUrl = data.data[0].url;
          }
          if (!imageUrl && data.data?.[0]?.b64_json) {
            imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
          }

          // Format 5: direct image field
          if (!imageUrl && data.image) {
            imageUrl = data.image;
          }

          console.log(`[ImageGallery] ${modelId} extracted imageUrl:`, imageUrl ? 'found' : 'NOT FOUND');

          return {
            model: modelId,
            modelName: modelId.split('/')[1],
            imageUrl,
            latency: Date.now() - modelStart
          };
        })
      );

      const totalTime = Date.now() - startTime;

      // Format results
      const galleryResults = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            model: imageModels[index],
            modelName: imageModels[index].split('/')[1],
            error: result.reason?.message || 'Generation failed',
            imageUrl: null,
            latency: 0
          };
        }
      });

      const successCount = galleryResults.filter(r => r.imageUrl).length;
      console.log(`[ImageGallery] Generated ${successCount}/${imageModels.length} images in ${totalTime}ms`);

      res.json({
        success: true,
        prompt,
        images: galleryResults,
        successCount,
        totalModels: imageModels.length,
        totalLatency: totalTime,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error("[ImageGallery] Error:", error);
      res.status(500).json({ error: "Image gallery failed", details: error.message });
    }
  }
);
