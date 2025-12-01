import { Router } from "express";
import { prisma } from "../prisma";
import { checkAuth } from "../middleware/auth";
import { storageService } from "../services/storage";
import { Prisma } from "@prisma/client";
import { encryptionService } from "../services/encryption";
import { chatCompletion } from "../services/openrouter";
import { billingService } from "../services/billing";
import { getGuestCredits, recordGuestUsage } from "../services/guestCredits";
import { v4 as uuidv4 } from "uuid";

export const llmRouter = Router();

// ═══════════════════════════════════════════════════════════════════════
// BILLING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

// Platform margin is already included in publicPricing (70% markup)
// No additional commission needed - publicPricing = basePricing * 1.7

// Default network for billing
const DEFAULT_BILLING_NETWORK = process.env.DEFAULT_BILLING_NETWORK || "avalanche";

/**
 * Upload a base64 image to DigitalOcean Spaces and return public URL
 * Handles both data URI format and raw base64
 */
async function uploadBase64ImageToSpaces(base64Data: string): Promise<string | null> {
  try {
    // Extract the actual base64 data (remove data:image/...;base64, prefix if present)
    let base64Content = base64Data;
    let contentType = 'image/png';

    if (base64Data.startsWith('data:')) {
      const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        contentType = matches[1];
        base64Content = matches[2];
      }
    }

    const buffer = Buffer.from(base64Content, 'base64');
    const publicUrl = await storageService.uploadBuffer(buffer, 'generated-images', contentType);
    console.log("[Image Upload] Uploaded to DO Spaces:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("[Image Upload] Failed to upload to DO Spaces:", error);
    return null;
  }
}

/**
 * Calculate the cost of an API request based on tokens and model pricing
 * Uses publicPricingPrompt/publicPricingCompletion which already include our 70% markup
 * Returns cost in USD to charge the user
 * FREE MODELS: If publicPricingPrompt === 0, the model is completely free for users
 */
async function calculateRequestCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<{ baseCost: number; totalCost: number; platformMargin: number; isFreeModel: boolean }> {
  // Get model pricing from database
  // publicPricing = OpenRouter price + 70% markup (our margin)
  // pricingPrompt/Completion = original OpenRouter prices
  const modelInfo = await prisma.model.findUnique({
    where: { openrouterId: model },
    select: {
      pricingPrompt: true,
      pricingCompletion: true,
      publicPricingPrompt: true,
      publicPricingCompletion: true
    }
  });

  // Check if this is a FREE model (publicPricingPrompt === 0)
  const publicPromptPriceRaw = modelInfo?.publicPricingPrompt ? Number(modelInfo.publicPricingPrompt) : null;
  const publicCompletionPriceRaw = modelInfo?.publicPricingCompletion ? Number(modelInfo.publicPricingCompletion) : null;
  const isFreeModel = publicPromptPriceRaw === 0 && publicCompletionPriceRaw === 0;

  // FREE MODELS: Return zero cost - no billing for users
  if (isFreeModel) {
    console.log(`[Billing] Model: ${model} - FREE MODEL (no charge)`);
    return {
      baseCost: 0,
      totalCost: 0,
      platformMargin: 0,
      isFreeModel: true
    };
  }

  // Use PUBLIC pricing (with our 70% markup) for charging users
  // Fallback to base pricing * 1.7 if public pricing not set
  const basePromptPrice = modelInfo?.pricingPrompt ? Number(modelInfo.pricingPrompt) : 0.001;
  const baseCompletionPrice = modelInfo?.pricingCompletion ? Number(modelInfo.pricingCompletion) : 0.002;

  const publicPromptPrice = publicPromptPriceRaw ?? basePromptPrice * 1.7; // 70% markup fallback
  const publicCompletionPrice = publicCompletionPriceRaw ?? baseCompletionPrice * 1.7; // 70% markup fallback

  // Calculate costs
  // OpenRouter pricing is per 1M tokens
  const baseCost = (inputTokens / 1_000_000) * basePromptPrice + (outputTokens / 1_000_000) * baseCompletionPrice;
  const totalCost = (inputTokens / 1_000_000) * publicPromptPrice + (outputTokens / 1_000_000) * publicCompletionPrice;
  const platformMargin = totalCost - baseCost;

  console.log(`[Billing] Model: ${model}`);
  console.log(`[Billing] Base prices: prompt=$${basePromptPrice}/1M, completion=$${baseCompletionPrice}/1M`);
  console.log(`[Billing] Public prices: prompt=$${publicPromptPrice}/1M, completion=$${publicCompletionPrice}/1M`);

  return {
    baseCost: Math.max(baseCost, 0.000001), // What we pay OpenRouter
    totalCost: Math.max(totalCost, 0.000001), // What user pays (includes our 70% margin)
    platformMargin: Math.max(platformMargin, 0), // Our profit
    isFreeModel: false
  };
}

/**
 * Check if a model is free (publicPricingPrompt === 0)
 */
async function isModelFree(modelId: string): Promise<boolean> {
  const modelInfo = await prisma.model.findUnique({
    where: { openrouterId: modelId },
    select: { publicPricingPrompt: true, publicPricingCompletion: true }
  });

  if (!modelInfo) return false;

  const promptPrice = modelInfo.publicPricingPrompt ? Number(modelInfo.publicPricingPrompt) : null;
  const completionPrice = modelInfo.publicPricingCompletion ? Number(modelInfo.publicPricingCompletion) : null;

  return promptPrice === 0 && completionPrice === 0;
}

/**
 * Check if user has sufficient credits for estimated cost
 * Returns true if allowed, false if insufficient credits
 * FREE MODELS always return allowed: true
 */
async function checkUserCredits(
  user: any,
  guestId: string | null,
  estimatedCost: number,
  modelId?: string
): Promise<{ allowed: boolean; balance: number; isGuest: boolean; isFreeModel: boolean }> {
  // Check if this is a FREE model - always allow
  if (modelId) {
    const freeModel = await isModelFree(modelId);
    if (freeModel) {
      console.log(`[Billing] Model ${modelId} is FREE - skipping credit check`);
      return { allowed: true, balance: 0, isGuest: !user?.walletAddress, isFreeModel: true };
    }
  }

  // Guest user - check shared guest credits service
  if (!user?.walletAddress) {
    const remainingCredits = getGuestCredits(guestId);
    return {
      allowed: remainingCredits >= estimatedCost,
      balance: remainingCredits,
      isGuest: true,
      isFreeModel: false
    };
  }

  // Wallet connected user - check on-chain balance
  try {
    const balance = await billingService.getBalance(user.walletAddress, DEFAULT_BILLING_NETWORK);
    const balanceNum = parseFloat(balance);
    return {
      allowed: balanceNum >= estimatedCost,
      balance: balanceNum,
      isGuest: false,
      isFreeModel: false
    };
  } catch {
    // If billing service is unavailable, allow the request silently
    return { allowed: true, balance: 0, isGuest: false, isFreeModel: false };
  }
}

/**
 * Record usage after a successful API call
 * Errors are silently ignored to avoid log spam - billing is best-effort
 */
async function recordUsageInternal(
  user: any,
  guestId: string | null,
  model: string,
  inputTokens: number,
  outputTokens: number,
  totalCost: number,
  requestId: string
): Promise<void> {
  // Guest user - track via shared guest credits service
  if (!user?.walletAddress) {
    recordGuestUsage(guestId, totalCost);
    return;
  }

  // Wallet connected user - record on-chain (best effort, errors silenced)
  try {
    await billingService.recordUsage(
      user.walletAddress,
      totalCost.toFixed(18), // 18 decimals precision
      model,
      inputTokens,
      outputTokens,
      requestId,
      DEFAULT_BILLING_NETWORK
    );
    // Success log only in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Billing] User ${user.walletAddress}: $${totalCost.toFixed(6)} for ${model}`);
    }
  } catch {
    // Silently ignore billing errors to avoid log spam
    // Billing is best-effort - won't fail user requests
  }
}

llmRouter.use(checkAuth);

// --- HISTORY ENDPOINTS ---
llmRouter.get("/history", async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    try {
        const conversations = await prisma.conversation.findMany({
            where: { userId: user.id },
            orderBy: { updatedAt: 'desc' },
            take: 20,
            select: { id: true, title: true, updatedAt: true }
        });
        const decrypted = conversations.map(c => ({ ...c, title: encryptionService.decrypt(c.title || "Untitled") }));
        res.json({ conversations: decrypted });
    } catch (err) { res.status(500).json({ error: "failed_to_fetch_history" }); }
});

llmRouter.get("/history/:id", async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    try {
        const conversation = await prisma.conversation.findFirst({
            where: { id, userId: user.id },
            include: { messages: { orderBy: { createdAt: 'asc' } } }
        });
        if (!conversation) return res.status(404).json({ error: "not_found" });
        const messages = conversation.messages.map(m => ({
            id: m.id, role: m.role, content: encryptionService.decrypt(m.content), model: m.modelUsed,
            timestamp: m.createdAt, metadata: m.metadata as Prisma.JsonObject || {},
            attachmentUrl: m.attachmentUrl, attachmentType: m.attachmentType
        }));
        res.json({ conversation: { ...conversation, messages } });
    } catch (err) { res.status(500).json({ error: "failed_to_fetch_messages" }); }
});

llmRouter.post("/history/:id/fork", async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    try {
        const original = await prisma.conversation.findUnique({
            where: { id },
            include: { messages: true }
        });
        if (!original) return res.status(404).json({ error: "not_found" });
        const clone = await prisma.conversation.create({
            data: {
                userId: user.id,
                title: encryptionService.decrypt(original.title || "Untitled") + " (Fork)",
                messages: {
                    create: original.messages.map(m => ({
                        role: m.role, content: m.content, modelUsed: m.modelUsed,
                        metadata: m.metadata || undefined, attachmentUrl: m.attachmentUrl, attachmentType: m.attachmentType
                    }))
                }
            }
        });
        res.json({ id: clone.id });
    } catch (err) { res.status(500).json({ error: "fork_failed" }); }
});

// Delete conversation
llmRouter.delete("/conversations/:id", async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    try {
        // Verify ownership first
        const conversation = await prisma.conversation.findFirst({
            where: { id, userId: user.id }
        });
        if (!conversation) return res.status(404).json({ error: "not_found" });

        // Delete messages first (cascade), then conversation
        await prisma.message.deleteMany({ where: { conversationId: id } });
        await prisma.conversation.delete({ where: { id } });

        res.json({ success: true });
    } catch (err) {
        console.error("Delete conversation error:", err);
        res.status(500).json({ error: "delete_failed" });
    }
});

// --- HELPER FUNCTIONS ---

async function uploadToStorage(url: string, contentType: string) {
    try {
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        return await storageService.uploadBuffer(buffer, "media", contentType);
    } catch (e) { throw new Error("Media generation failed"); }
}

type ToolResult = { content?: string; attachmentUrl?: string; type?: string; context?: string; isContext?: boolean; sources?: string[] };

const tools: Record<string, { trigger: RegExp; execute: (prompt: string) => Promise<ToolResult> }> = {
    image: {
        trigger: /^\/(image|img|generate)\s+/i,
        execute: async (prompt: string) => {
            const cleanPrompt = prompt.replace(/^\/(image|img|generate)\s+/i, "").trim();
            const seed = Math.floor(Math.random() * 1000000);
            const tempUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?nologo=true&seed=${seed}&width=1024&height=1024`;
            const publicUrl = await uploadToStorage(tempUrl, "image/jpeg");
            return { content: `![Generated Image](${publicUrl})`, attachmentUrl: publicUrl, type: 'image' };
        }
    },
    video: {
        trigger: /^\/(video|vid)\s+/i,
        execute: async (prompt: string) => {
            const videoPrompt = prompt.replace(/^\/(video|vid)\s+/i, "").trim();
            console.log("Generating video for:", videoPrompt);
            const publicUrl = await uploadToStorage("https://media.giphy.com/media/3o7TKv6MgQfdSRT01G/giphy.gif", "image/gif"); 
            return { content: `\n![Video Generated](${publicUrl})`, attachmentUrl: publicUrl, type: 'video' };
        }
    },
    audio: {
        trigger: /^\/(audio|speak)\s+/i,
        execute: async (prompt: string) => {
            const text = prompt.replace(/^\/(audio|speak)\s+/i, "").trim();
            const tempUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text.substring(0, 200))}`; // Limit text length to avoid URL issues
            const publicUrl = await uploadToStorage(tempUrl, "audio/mp3");
            return { content: `\n[Audio Generated]`, attachmentUrl: publicUrl, type: 'audio' };
        }
    }
};

const saveInteraction = async (user: any, conversationId: string | null, userMessage: string, assistantResponse: string, model: string, attachmentUrl?: string, metadata?: any) => {
  if (!user) return conversationId;
  try {
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      const conv = await prisma.conversation.create({
        data: { userId: user.id, title: encryptionService.encrypt(userMessage.substring(0, 50)) }
      });
      currentConversationId = conv.id;
    }

    // Check if the *most recent* user message matches the current one (deduplication for parallel requests)
    const lastUserMsg = await prisma.message.findFirst({
        where: { conversationId: currentConversationId, role: 'user' },
        orderBy: { createdAt: 'desc' }
    });

    const encryptedUserMsg = encryptionService.encrypt(userMessage);
    let shouldSaveUserMsg = true;

    if (lastUserMsg) {
        const decryptedLast = encryptionService.decrypt(lastUserMsg.content);
        // Simple content check. 
        if (decryptedLast === userMessage) {
            shouldSaveUserMsg = false;
        }
    }

    if (shouldSaveUserMsg) {
        await prisma.message.create({
            data: { conversationId: currentConversationId, role: "user", content: encryptedUserMsg }
        });
    }

    await prisma.message.create({
      data: { 
          conversationId: currentConversationId, role: "assistant", 
          content: encryptionService.encrypt(assistantResponse), modelUsed: model, 
          metadata: metadata || Prisma.JsonNull, attachmentUrl, attachmentType: metadata?.attachmentType
      }
    });
    await prisma.conversation.update({ where: { id: currentConversationId }, data: { updatedAt: new Date() } });
    await prisma.user.update({ where: { id: user.id }, data: { messageCount: { increment: 1 } } });
    return currentConversationId;
  } catch (err) { return conversationId; }
};

// --- ROUTES ---

llmRouter.post("/conversations", async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const { title } = req.body;
    try {
        const conv = await prisma.conversation.create({
            data: { 
                userId: user.id, 
                title: encryptionService.encrypt(title || "New Chat") 
            }
        });
        res.json({ id: conv.id });
    } catch (e) { 
        console.error("Create conversation failed", e);
        res.status(500).json({ error: "failed_to_create_conversation" }); 
    }
});

llmRouter.post("/chat", async (req, res) => {
  const { messages, model, conversationId } = req.body || {};
  const user = (req as any).user;
  const guestId = req.headers["x-guest-id"] as string | null;

  if (!user) return res.status(401).json({ error: "unauthorized" });
  if (user && !user.isPremium && user.messageCount >= 1000) {
    return res.status(402).json({ error: "free_limit_reached" });
  }

  // Generate unique request ID for billing tracking
  const requestId = uuidv4();

  // Credit check before request (pass model to check if it's free)
  const estimatedCost = 0.005;
  const creditCheck = await checkUserCredits(user, guestId, estimatedCost, model);
  if (!creditCheck.allowed) {
    return res.status(402).json({
      error: "insufficient_credits",
      balance: creditCheck.balance.toFixed(4),
      required: estimatedCost.toFixed(4),
      isGuest: creditCheck.isGuest
    });
  }

  const lastUserMessage = messages[messages.length - 1]?.content || "";

  // Check Tools (Non-streaming) - Fixed cost for tool usage
  const TOOL_COST = 0.001; // $0.001 per tool use
  for (const [key, tool] of Object.entries(tools)) {
      if (tool.trigger.test(lastUserMessage)) {
          try {
              const result = await tool.execute(lastUserMessage);
              const contentToSave = result.content || "";
              const newConversationId = await saveInteraction(
                  user, conversationId, lastUserMessage, contentToSave, "tool-" + key, result.attachmentUrl, {
                    attachmentType: result.type,
                    billing: { toolCostUSD: TOOL_COST.toFixed(8), requestId }
                  }
              );

              // Record tool usage (errors silenced)
              recordUsageInternal(user, guestId, "tool-" + key, 0, 0, TOOL_COST, requestId).catch(() => {});

              return res.json({ reply: contentToSave, attachmentUrl: result.attachmentUrl, attachmentType: result.type, conversationId: newConversationId });
          } catch (e) {
              return res.status(500).json({ error: "tool_failed" });
          }
      }
  }

  try {
    // Fallback to a non-streaming chatCompletion if streaming isn't requested or possible
    const reply = await chatCompletion({ messages, model });
    const targetModel = model || "default";

    // Estimate tokens and calculate cost
    const inputTokens = Math.ceil(lastUserMessage.length / 4);
    const outputTokens = Math.ceil(reply.length / 4);
    const costData = await calculateRequestCost(targetModel, inputTokens, outputTokens);

    const newConversationId = await saveInteraction(user, conversationId, lastUserMessage, reply, targetModel, undefined, {
      billing: {
        inputTokens,
        outputTokens,
        baseCostUSD: costData.baseCost.toFixed(8),
        platformMarginUSD: costData.platformMargin.toFixed(8),
        totalCostUSD: costData.totalCost.toFixed(8),
        requestId
      }
    });

    // Record usage
    recordUsageInternal(user, guestId, targetModel, inputTokens, outputTokens, costData.totalCost, requestId)
      .catch(() => {}); // Billing errors silenced

    res.json({
      reply,
      conversationId: newConversationId,
      billing: { inputTokens, outputTokens, costUSD: costData.totalCost.toFixed(6) }
    });
  } catch (error) {
    console.error("LLM non-stream chat error", error);
    res.status(500).json({ error: "llm_failed" });
  }
});

llmRouter.post("/chat/stream", async (req, res) => {
  console.log("\n--- STREAM CHAT REQUEST ---");
  const { messages, model, conversationId, webSearch } = req.body || {};
  console.log("1. Payload received. webSearch:", webSearch, "(Type:", typeof webSearch, ")");
  console.log("2. Model:", model);

  const user = (req as any).user;
  const guestId = req.headers["x-guest-id"] as string | null;

  if (!user) { res.writeHead(401); res.write(JSON.stringify({ error: "unauthorized" })); return res.end(); }
  if (user && !user.isPremium && user.messageCount >= 1000) {
     res.writeHead(402); res.write(JSON.stringify({ error: "free_limit_reached" })); return res.end();
  }

  // Generate unique request ID for billing tracking
  const requestId = uuidv4();

  // ═══════════════════════════════════════════════════════════════════════
  // CREDIT CHECK - Before making the API call (pass model to check if free)
  // ═══════════════════════════════════════════════════════════════════════
  const estimatedCost = 0.005; // Estimate $0.005 per request as baseline
  const creditCheck = await checkUserCredits(user, guestId, estimatedCost, model);

  console.log(`[Billing] Credit check: ${creditCheck.isGuest ? 'Guest' : user.walletAddress} - Balance: $${creditCheck.balance.toFixed(4)}, Allowed: ${creditCheck.allowed}, Free Model: ${creditCheck.isFreeModel}`);

  if (!creditCheck.allowed) {
    res.writeHead(402);
    res.write(JSON.stringify({
      error: "insufficient_credits",
      balance: creditCheck.balance.toFixed(4),
      required: estimatedCost.toFixed(4),
      isGuest: creditCheck.isGuest
    }));
    return res.end();
  }

  const lastUserMessage = messages[messages.length - 1]?.content || "";

  // 1. Conversation ID
  let finalConversationId = conversationId;
  if (!finalConversationId) {
      try {
          const conv = await prisma.conversation.create({ data: { userId: user.id, title: encryptionService.encrypt(lastUserMessage.substring(0, 50)) } });
          finalConversationId = conv.id;
      } catch(e) { res.writeHead(500); return res.end(); }
  }

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
  res.write(`data: ${JSON.stringify({ conversationId: finalConversationId, requestId })}\n\n`);

  // 2. Tools (Explicit Commands - e.g., /image, /video) - Fixed cost for tool usage
  const TOOL_COST = 0.001; // $0.001 per tool use
  for (const [key, tool] of Object.entries(tools)) {
      if (tool.trigger.test(lastUserMessage)) {
          try {
              const result = await tool.execute(lastUserMessage);
              const contentToSave = result.content || "";
              res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: contentToSave } }] })}\n\n`);
              if (result.attachmentUrl) res.write(`data: ${JSON.stringify({ attachmentUrl: result.attachmentUrl, attachmentType: result.type })}\n\n`);
              await saveInteraction(user, finalConversationId, lastUserMessage, contentToSave, "tool-" + key, result.attachmentUrl, {
                attachmentType: result.type,
                billing: { toolCostUSD: TOOL_COST.toFixed(8), requestId }
              });

              // Record tool usage for billing
              recordUsageInternal(user, guestId, "tool-" + key, 0, 0, TOOL_COST, requestId)
                .catch(() => {}); // Billing errors silenced

              res.write(`data: ${JSON.stringify({ billing: { costUSD: TOOL_COST.toFixed(6), requestId } })}\n\n`);
              res.write(`data: [DONE]\n\n`);
              return res.end();
          } catch (e) {
             res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `Error: Tool ${key} failed` } }] })}\n\n`);
             res.write(`data: [DONE]\n\n`);
             return res.end();
          }
      }
  }

  // 3. LLM & Auto-RAG
  const targetModel = model || "openai/gpt-3.5-turbo";
  const modelDetails = await prisma.model.findUnique({ where: { openrouterId: targetModel }, select: { architecture: true } });
  const architecture = modelDetails?.architecture as any;
  
  // Web Search Detection (Runtime)
  // Check both DB flag (from OpenRouter's supported_parameters) AND ID patterns
  // DB has_web_search=true means the model has NATIVE web search via its provider
  // ID patterns catch models with :online suffix (OpenRouter's online mode)
  const hasNativeWebSearchInDB = architecture?.has_web_search === true;
  const hasSonar = targetModel.includes("sonar");
  const hasOnlineSuffix = targetModel.endsWith(":online");
  const hasOnlineDash = targetModel.includes("-online");
  const hasSearchInName = targetModel.includes("-search");

  // Model has native web search if: DB says so OR ID pattern matches
  const isNativeWebSearch = hasNativeWebSearchInDB || hasSonar || hasOnlineSuffix || hasOnlineDash || hasSearchInName;

  console.log("3. Model Detection:");
  console.log(`   - Target: ${targetModel}`);
  console.log(`   - DB has_web_search (from supported_parameters): ${hasNativeWebSearchInDB}`);
  console.log(`   - ID Checks: sonar=${hasSonar}, :online=${hasOnlineSuffix}, -online=${hasOnlineDash}, -search=${hasSearchInName}`);
  console.log(`   - FINAL isNativeWebSearch: ${isNativeWebSearch}`);

  const openRouterMessages = [...messages];
  
  const payloadBody: any = {
      model: targetModel,
      messages: openRouterMessages,
      stream: true,
  };

  if (architecture?.output_modalities?.includes("image")) {
      payloadBody.modalities = ["image", "text"];
  }

  // Enable web search via OpenRouter's plugin system
  // OpenRouter automatically uses native search for supported providers (OpenAI, Anthropic, Perplexity)
  // and falls back to Exa for others - no need to specify engine
  let webSearchType: 'native' | 'exa' | null = null;
  if (webSearch) {
      payloadBody.plugins = [{ id: "web" }];
      // Determine search type for frontend display
      webSearchType = isNativeWebSearch ? 'native' : 'exa';
      console.log(`4. Web Search Enabled: plugins=[{id:'web'}] - Type: ${webSearchType.toUpperCase()}`);
  }

  try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "HTTP-Referer": "https://zeroprompt.app",
              "X-Title": "ZeroPrompt",
              "Content-Type": "application/json"
          },
          body: JSON.stringify(payloadBody) 
      });

      if (!response.ok) {
          const err = await response.text();
          console.error("OpenRouter API Error (Non-OK response):", response.status, err);
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `API Error: ${response.statusText} - ${err}` } }] })}\n\n`);
          res.write(`data: [DONE]\n\n`);
          return res.end();
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let fullReasoning = "";
      let fullSources: string[] = []; // Array of URLs for frontend compatibility
      let generatedImages: string[] = []; // Array of generated image URLs
      let buffer = "";
      let chunkCount = 0;

      // ═══════════════════════════════════════════════════════════════════════
      // USAGE TRACKING - Capture tokens from OpenRouter response
      // ═══════════════════════════════════════════════════════════════════════
      let usageData: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = null;

      // Send web search type indicator at start of stream
      if (webSearchType) {
          res.write(`data: ${JSON.stringify({ webSearchType })}\n\n`);
      }

      while (true && reader) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep the last partial line in the buffer

          for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed.startsWith(":")) continue; // Ignore keep-alive comments
              if (trimmed === "data: [DONE]") continue;

              if (trimmed.startsWith("data: ")) {
                  const jsonStr = trimmed.slice(6);
                  try {
                      const parsed = JSON.parse(jsonStr);

                      // Log first 10 chunks with more detail for debugging
                      if (chunkCount < 10) {
                          console.log(`[Stream Chunk ${chunkCount}]`, JSON.stringify(parsed).substring(0, 400) + "...");
                          chunkCount++;
                      }

                      // Log any chunk that has unusual fields (not just standard delta content)
                      const hasUnusualFields = Object.keys(parsed).some(k =>
                          !['id', 'provider', 'model', 'object', 'created', 'choices'].includes(k)
                      ) || (parsed.choices?.[0]?.delta && Object.keys(parsed.choices[0].delta).some(k =>
                          !['role', 'content'].includes(k)
                      ));

                      if (hasUnusualFields && chunkCount >= 10) {
                          console.log(`[Stream Unusual Chunk]`, JSON.stringify(parsed, null, 2));
                      }

                      // Capture web search sources/citations from multiple possible locations
                      // 1. OpenRouter/OpenAI annotations format (most common with web plugin)
                      const deltaAnnotations = parsed.choices?.[0]?.delta?.annotations;
                      if (Array.isArray(deltaAnnotations) && deltaAnnotations.length > 0) {
                          const extractedUrls = deltaAnnotations
                              .filter((ann: any) => ann.type === 'url_citation' && ann.url_citation?.url)
                              .map((ann: any) => ann.url_citation.url);

                          if (extractedUrls.length > 0) {
                              // Avoid duplicates
                              const newUrls = extractedUrls.filter((url: string) => !fullSources.includes(url));
                              if (newUrls.length > 0) {
                                  console.log("[Stream Debug] Found citations in delta.annotations:", newUrls);
                                  fullSources = [...fullSources, ...newUrls];
                                  res.write(`data: ${JSON.stringify({ sources: newUrls })}\n\n`);
                              }
                          }
                      }

                      // 2. Legacy/alternative formats (Perplexity, other providers)
                      const hasCitations = parsed.citations;
                      const hasSources = parsed.sources;
                      const hasWebResults = parsed.web_search_results;
                      const hasToolCalls = parsed.choices?.[0]?.delta?.tool_calls;
                      const hasWebSearch = parsed.web_search || parsed.webSearch;

                      if (hasCitations || hasSources || hasWebResults || hasToolCalls || hasWebSearch) {
                          console.log("[Stream Debug] Found Legacy Web Data Keys:", Object.keys(parsed));

                          const sourcesData = hasCitations || hasSources || hasWebResults;
                          if (Array.isArray(sourcesData)) {
                              const extractedUrls = sourcesData.map((s: any) => {
                                  if (typeof s === 'string') return s;
                                  return s.url || s.link || s.href || s.source || '';
                              }).filter((url: string) => url);

                              // Avoid duplicates
                              const newUrls = extractedUrls.filter((url: string) => !fullSources.includes(url));
                              if (newUrls.length > 0) {
                                  fullSources = [...fullSources, ...newUrls];
                                  console.log("[Stream Debug] Extracted Legacy URLs:", newUrls);
                                  res.write(`data: ${JSON.stringify({ sources: newUrls })}\n\n`);
                              }
                          }
                      }

                      // Capture usage data from OpenRouter
                      // OpenRouter sends usage in the response body or final chunks
                      if (parsed.usage) {
                          usageData = {
                              prompt_tokens: parsed.usage.prompt_tokens || 0,
                              completion_tokens: parsed.usage.completion_tokens || 0,
                              total_tokens: parsed.usage.total_tokens || 0
                          };
                          console.log("[Billing] Captured usage data:", usageData);
                      }

                      const delta = parsed.choices?.[0]?.delta || {};

                      // Handle reasoning from multiple sources:
                      // 1. delta.reasoning (OpenRouter native)
                      // 2. delta.reasoning_content (some providers)
                      // 3. <think> tags in content (DeepSeek, etc.)
                      if (delta.reasoning) {
                          fullReasoning += delta.reasoning;
                          // Forward reasoning to frontend
                          res.write(`data: ${JSON.stringify({ reasoning: delta.reasoning })}\n\n`);
                      }
                      if (delta.reasoning_content) {
                          fullReasoning += delta.reasoning_content;
                          res.write(`data: ${JSON.stringify({ reasoning: delta.reasoning_content })}\n\n`);
                      }

                      // Handle image generation outputs from multiple formats:
                      // 1. Gemini models: delta.images array
                      // 2. OpenAI/GPT-4o: delta.image_url or message.content array
                      // 3. Content array with image_url parts

                      // Check Gemini format: delta.images array
                      const deltaImages = delta.images;
                      if (Array.isArray(deltaImages) && deltaImages.length > 0) {
                          for (const img of deltaImages) {
                              const imageUrl = img.image_url?.url || img.url;
                              if (imageUrl) {
                                  console.log("[Stream Debug] Gemini image found:", imageUrl.substring(0, 100) + "...");
                                  // Upload base64 images to DO Spaces
                                  if (imageUrl.startsWith('data:')) {
                                      const publicUrl = await uploadBase64ImageToSpaces(imageUrl);
                                      if (publicUrl) {
                                          generatedImages.push(publicUrl);
                                          res.write(`data: ${JSON.stringify({ generatedImage: publicUrl })}\n\n`);
                                      }
                                  } else {
                                      generatedImages.push(imageUrl);
                                      res.write(`data: ${JSON.stringify({ generatedImage: imageUrl })}\n\n`);
                                  }
                              }
                          }
                      }

                      // Check OpenAI/other format: delta.image_url directly
                      const deltaImage = delta.image_url?.url ||
                                         parsed.choices?.[0]?.message?.content?.[0]?.image_url?.url;
                      if (deltaImage && !generatedImages.includes(deltaImage)) {
                          console.log("[Stream Debug] Direct image_url found:", deltaImage.substring(0, 100) + "...");
                          // Upload base64 images to DO Spaces
                          if (deltaImage.startsWith('data:')) {
                              const publicUrl = await uploadBase64ImageToSpaces(deltaImage);
                              if (publicUrl) {
                                  generatedImages.push(publicUrl);
                                  res.write(`data: ${JSON.stringify({ generatedImage: publicUrl })}\n\n`);
                              }
                          } else {
                              generatedImages.push(deltaImage);
                              res.write(`data: ${JSON.stringify({ generatedImage: deltaImage })}\n\n`);
                          }
                      }

                      // Check content array format (some providers)
                      const contentParts = delta.content;
                      if (Array.isArray(contentParts)) {
                          for (const part of contentParts) {
                              if (part.type === 'image_url' && part.image_url?.url) {
                                  const imgUrl = part.image_url.url;
                                  if (!generatedImages.includes(imgUrl)) {
                                      console.log("[Stream Debug] Image in content array:", imgUrl.substring(0, 50) + "...");
                                      // Upload base64 images to DO Spaces
                                      if (imgUrl.startsWith('data:')) {
                                          const publicUrl = await uploadBase64ImageToSpaces(imgUrl);
                                          if (publicUrl) {
                                              generatedImages.push(publicUrl);
                                              res.write(`data: ${JSON.stringify({ generatedImage: publicUrl })}\n\n`);
                                          }
                                      } else {
                                          generatedImages.push(imgUrl);
                                          res.write(`data: ${JSON.stringify({ generatedImage: imgUrl })}\n\n`);
                                      }
                                  }
                              }
                          }
                      }

                      // Handle content - extract <think> tags if present
                      if (delta.content && typeof delta.content === 'string') {
                          let contentToAdd = delta.content;

                          // If content contains think tags, extract reasoning
                          if (contentToAdd.includes('<think>') || contentToAdd.includes('</think>')) {
                              // Extract full think blocks if complete
                              const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
                              let match;
                              while ((match = thinkRegex.exec(contentToAdd)) !== null) {
                                  const extractedReasoning = match[1].trim();
                                  if (extractedReasoning) {
                                      fullReasoning += extractedReasoning + '\n';
                                      res.write(`data: ${JSON.stringify({ reasoning: extractedReasoning })}\n\n`);
                                  }
                              }
                              // Remove think blocks from content
                              contentToAdd = contentToAdd.replace(thinkRegex, '').trim();

                              // Handle partial opening tag at end
                              contentToAdd = contentToAdd.replace(/<think>[\s\S]*$/gi, '');
                              // Handle partial closing tag or orphan tags
                              contentToAdd = contentToAdd.replace(/<\/think>/gi, '');
                              contentToAdd = contentToAdd.replace(/<think>/gi, '');
                          }

                          if (contentToAdd) {
                              fullResponse += contentToAdd;
                          }
                      }

                      // Write the original line for standard processing
                      res.write(`${line}\n\n`);
                  } catch (e) {
                      console.error("Error parsing stream line to JSON:", e, "Line:", trimmed);
                  }
              }
          }
      }

      const interactionMetadata: any = {};
      if (fullReasoning) interactionMetadata.reasoning = fullReasoning;
      if (fullSources.length > 0) interactionMetadata.sources = fullSources;
      if (generatedImages.length > 0) interactionMetadata.generatedImages = generatedImages;

      console.log(`5. Stream Complete for ${targetModel}:`);
      console.log(`   - Response Length: ${fullResponse.length} chars`);
      console.log(`   - Reasoning Length: ${fullReasoning.length} chars`);
      console.log(`   - Sources Found: ${fullSources.length}`);
      console.log(`   - Images Generated: ${generatedImages.length}`);
      if (fullSources.length > 0) {
          console.log(`   - Sources:`, fullSources);
      }

      // ═══════════════════════════════════════════════════════════════════════
      // BILLING - Calculate and record usage after successful stream
      // ═══════════════════════════════════════════════════════════════════════
      const inputTokens = usageData?.prompt_tokens || Math.ceil(lastUserMessage.length / 4); // Estimate if not available
      const outputTokens = usageData?.completion_tokens || Math.ceil(fullResponse.length / 4);

      console.log(`[Billing] Tokens - Input: ${inputTokens}, Output: ${outputTokens}`);

      // Calculate cost using public pricing (includes 70% platform margin)
      const costData = await calculateRequestCost(targetModel, inputTokens, outputTokens);
      console.log(`[Billing] Cost - Base: $${costData.baseCost.toFixed(6)}, Margin: $${costData.platformMargin.toFixed(6)}, Total: $${costData.totalCost.toFixed(6)}`);

      // Add cost info to metadata
      interactionMetadata.billing = {
        inputTokens,
        outputTokens,
        baseCostUSD: costData.baseCost.toFixed(8),
        platformMarginUSD: costData.platformMargin.toFixed(8),
        totalCostUSD: costData.totalCost.toFixed(8),
        requestId
      };

      await saveInteraction(user, finalConversationId, lastUserMessage, fullResponse, targetModel, undefined, interactionMetadata);

      // Record usage for billing (async, don't block response)
      recordUsageInternal(user, guestId, targetModel, inputTokens, outputTokens, costData.totalCost, requestId)
        .catch(() => {}); // Billing errors silenced

      // Send cost info to frontend
      res.write(`data: ${JSON.stringify({
        billing: {
          inputTokens,
          outputTokens,
          costUSD: costData.totalCost.toFixed(6),
          requestId
        }
      })}\n\n`);

      res.write(`data: [DONE]\n\n`);
      res.end();

  } catch (e) {
      console.error("Stream crash (Outer catch block):", e);
      res.write(`event: error\ndata: stream_failed: ${(e as Error).message}\n\n`);
      res.end();
  }
});
