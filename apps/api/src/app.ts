import express from "express";
import cors from "cors";
import { prisma } from "./prisma";
import { promptRouter } from "./routes/prompt";
import { llmRouter } from "./routes/llm";
import { modelsRouter } from "./routes/models";
import { walletRouter } from "./routes/wallet";
import { storageRouter } from "./routes/storage";
import { adminRouter } from "./routes/admin";
import { billingRouter } from "./routes/billing";
import { agentRouter } from "./routes/agent";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cors({ origin: "*" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/prompts", promptRouter);
  app.use("/llm", llmRouter);
  app.use("/models", modelsRouter);
  app.use("/wallet", walletRouter);
  app.use("/storage", storageRouter);
  app.use("/admin", adminRouter);
  app.use("/billing", billingRouter);
  app.use("/agent", agentRouter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error", err);
    res.status(500).json({ error: "internal_error" });
  });

  const shutdown = async () => {
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return app;
}
