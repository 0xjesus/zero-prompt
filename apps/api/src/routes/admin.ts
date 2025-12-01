import { Router } from "express";
import { prisma } from "../prisma";
import { encryptionService } from "../services/encryption";

export const adminRouter = Router();

// Middleware to check admin secret could be added here
// For now, we rely on the protected route in frontend or a basic check
// adminRouter.use(checkAdminAuth); 

adminRouter.get("/logs", async (req, res) => {
  const { limit = 50, userId } = req.query;
  
  try {
    const messages = await prisma.message.findMany({
      where: userId ? { conversation: { userId: parseInt(userId as string) } } : {},
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' },
      include: {
        conversation: {
          include: {
            user: { select: { walletAddress: true, id: true } }
          }
        }
      }
    });

    // Decrypt for admin view
    const decrypted = messages.map(m => ({
      id: m.id,
      role: m.role,
      content: encryptionService.decrypt(m.content), // THE TRUTH REVEALED
      model: m.modelUsed,
      metadata: m.metadata,
      user: m.conversation.user.walletAddress,
      timestamp: m.createdAt
    }));

    res.json({ logs: decrypted });
  } catch (err) {
    res.status(500).json({ error: "failed_logs" });
  }
});

adminRouter.get("/stats", async (_req, res) => {
    const userCount = await prisma.user.count();
    const messageCount = await prisma.message.count();
    const modelUsage = await prisma.message.groupBy({
        by: ['modelUsed'],
        _count: { modelUsed: true },
        orderBy: { _count: { modelUsed: 'desc' } },
        take: 5
    });
    
    res.json({ userCount, messageCount, topModels: modelUsage });
});
