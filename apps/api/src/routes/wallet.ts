import { Router } from "express";
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import { prisma } from "../prisma";

export const walletRouter = Router();

const messageForNonce = (nonce: string) => `Sign this message for ZeroPrompt: ${nonce}`;

walletRouter.post("/nonce", async (req, res) => {
  console.log("[Wallet] /nonce request received:", req.body);
  const { wallet } = req.body || {};
  if (!wallet) return res.status(400).json({ error: "wallet_required" });

  // Check if user already has a valid nonce (not used yet)
  const existingUser = await prisma.user.findUnique({
    where: { walletAddress: wallet.toLowerCase() }
  });

  // If user already has a nonce, return it instead of generating a new one
  // This prevents race conditions from multiple nonce requests
  if (existingUser && existingUser.nonce) {
    console.log("[Wallet] Returning existing nonce for:", wallet.toLowerCase());
    return res.json({ nonce: existingUser.nonce, message: messageForNonce(existingUser.nonce) });
  }

  // Generate new nonce only if none exists
  const nonce = randomBytes(16).toString("hex");
  const user = await prisma.user.upsert({
    where: { walletAddress: wallet.toLowerCase() },
    update: { nonce },
    create: { walletAddress: wallet.toLowerCase(), nonce, isGuest: false }
  });

  console.log("[Wallet] New nonce generated for:", wallet.toLowerCase());
  res.json({ nonce: user.nonce, message: messageForNonce(user.nonce || "") });
});

walletRouter.post("/verify", async (req, res) => {
  console.log("[Wallet] /verify request received:", { wallet: req.body?.wallet, hasSignature: !!req.body?.signature, guestId: req.body?.guestId });
  const { wallet, signature, guestId } = req.body || {};
  if (!wallet || !signature) {
    console.log("[Wallet] Missing wallet or signature");
    return res.status(400).json({ error: "wallet_and_signature_required" });
  }

  const walletUser = await prisma.user.findUnique({ where: { walletAddress: wallet.toLowerCase() } });
  if (!walletUser || !walletUser.nonce) {
    console.log("[Wallet] Nonce missing for:", wallet.toLowerCase());
    return res.status(400).json({ error: "nonce_missing" });
  }

  const message = messageForNonce(walletUser.nonce);
  console.log("[Wallet] Verifying with nonce:", walletUser.nonce);
  console.log("[Wallet] Full message to verify:", message);
  console.log("[Wallet] Signature received:", signature.substring(0, 30) + "...");

  let recovered: string;
  try {
    recovered = ethers.verifyMessage(message, signature).toLowerCase();
    console.log("[Wallet] Recovered address:", recovered, "Expected:", wallet.toLowerCase());
  } catch (err) {
    console.log("[Wallet] Invalid signature error:", err);
    return res.status(400).json({ error: "invalid_signature" });
  }

  if (recovered !== wallet.toLowerCase()) {
    console.log("[Wallet] Wallet mismatch - recovered:", recovered, "expected:", wallet.toLowerCase());
    return res.status(401).json({ error: "wallet_mismatch" });
  }

  console.log("[Wallet] Signature verified successfully for:", wallet.toLowerCase());

  const sessionToken = randomBytes(24).toString("hex");
  const sessionExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  // Migration: If guestId provided, migrate conversations from guest to wallet user
  let migratedConversations = 0;
  if (guestId) {
    const guestUser = await prisma.user.findUnique({
      where: { guestId },
      include: { conversations: true }
    });

    if (guestUser && guestUser.conversations.length > 0) {
      console.log(`[Wallet] Migrating ${guestUser.conversations.length} conversations from guest ${guestId} to wallet ${wallet}`);

      // Transfer all conversations from guest to wallet user
      await prisma.conversation.updateMany({
        where: { userId: guestUser.id },
        data: { userId: walletUser.id }
      });

      migratedConversations = guestUser.conversations.length;

      // Merge message count
      await prisma.user.update({
        where: { id: walletUser.id },
        data: {
          messageCount: walletUser.messageCount + guestUser.messageCount
        }
      });

      // Delete the guest user (optional - could keep for audit)
      await prisma.user.delete({ where: { id: guestUser.id } });
      console.log(`[Wallet] Migration complete: ${migratedConversations} conversations moved, guest user deleted`);
    }
  }

  // Update wallet user with session
  const updatedUser = await prisma.user.update({
    where: { walletAddress: wallet.toLowerCase() },
    data: {
      sessionToken,
      sessionExpiresAt,
      isGuest: false,
      nonce: null // Clear nonce after use
    },
    include: {
      conversations: { select: { id: true } }
    }
  });

  res.json({
    sessionToken,
    sessionExpiresAt,
    wallet: wallet.toLowerCase(),
    migratedConversations,
    totalConversations: updatedUser.conversations.length,
    messageCount: updatedUser.messageCount
  });
});

// Get user info from session token
walletRouter.get("/me", async (req, res) => {
  const sessionToken = req.headers["x-session-token"] as string;
  if (!sessionToken) {
    return res.status(401).json({ error: "session_token_required" });
  }

  const user = await prisma.user.findFirst({
    where: {
      sessionToken,
      sessionExpiresAt: { gt: new Date() }
    },
    select: {
      walletAddress: true,
      displayName: true,
      messageCount: true,
      isPremium: true,
      createdAt: true,
      _count: { select: { conversations: true } }
    }
  });

  if (!user) {
    return res.status(401).json({ error: "invalid_or_expired_session" });
  }

  res.json({
    wallet: user.walletAddress,
    displayName: user.displayName,
    messageCount: user.messageCount,
    isPremium: user.isPremium,
    conversationCount: user._count.conversations,
    memberSince: user.createdAt
  });
});

// Logout - invalidate session
walletRouter.post("/logout", async (req, res) => {
  const sessionToken = req.headers["x-session-token"] as string;
  if (sessionToken) {
    await prisma.user.updateMany({
      where: { sessionToken },
      data: { sessionToken: null, sessionExpiresAt: null }
    });
  }
  res.json({ success: true });
});
