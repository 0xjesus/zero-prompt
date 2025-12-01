import { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma";

export const checkAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.headers["x-session-token"] as string;
  const guestId = req.headers["x-guest-id"] as string;
  
  // 1. Try Session Token (Wallet User)
  if (token) {
    try {
      const user = await prisma.user.findFirst({
        where: {
          sessionToken: token,
          sessionExpiresAt: { gt: new Date() }
        }
      });
      if (user) {
          (req as any).user = user;
          return next();
      }
    } catch (e) {
        // Fall through to other methods
    }
  }

  // 2. Try Guest ID (Anonymous User)
  if (guestId) {
      try {
          // Find or create a guest user
          const user = await prisma.user.upsert({
            where: { guestId },
            create: { guestId, isGuest: true },
            update: {} // No update needed if found
          });
          
          (req as any).user = user;
          return next();
      } catch (e) {
        console.error("Guest handling failed", e);
      }
  }

  // 3. No Auth
  (req as any).user = null;
  next();
};