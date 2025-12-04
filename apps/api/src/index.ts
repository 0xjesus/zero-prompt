import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { createApp } from "./app";
import { prisma } from "./prisma";
import { startModelSyncCron } from "./jobs/modelSyncCron";
import { vaultService } from "./services/vault";

const port = parseInt(process.env.PORT || "3001", 10);

async function start() {
  const app = createApp();

  startModelSyncCron();

  // Log vault status (no background polling - deposits verified on-demand via txHash)
  if (vaultService.isEnabled()) {
    console.log("[Vault] ✓ Vault service ready (instant verification via txHash)");
  } else {
    console.warn("[Vault] ✗ Vault service disabled (check VAULT_CONTRACT_ADDRESS)");
  }

  const server = app.listen(port, () => {
    console.log(`ZeroPrompt API listening on http://localhost:${port}`);
  });

  const shutdown = async () => {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
