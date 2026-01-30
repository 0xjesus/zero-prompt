import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { createApp } from "./app";
import { prisma } from "./prisma";
import { startModelSyncCron } from "./jobs/modelSyncCron";
import { vaultService } from "./services/vault";
import { subnetNodeService } from "./services/subnetNodes";

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

  // Initialize subnet node service for decentralized mode
  if (process.env.SUBNET_RPC_URL && process.env.OPERATOR_REGISTRY_ADDRESS && process.env.PRIVATE_KEY) {
    try {
      await subnetNodeService.initialize({
        rpcUrl: process.env.SUBNET_RPC_URL,
        privateKey: process.env.PRIVATE_KEY,
        operatorRegistryAddress: process.env.OPERATOR_REGISTRY_ADDRESS,
        subnetRewardsAddress: process.env.SUBNET_REWARDS_ADDRESS || "",
      });
      console.log("[Subnet] ✓ Decentralized Ollama network ready");
    } catch (error) {
      console.warn("[Subnet] ✗ Failed to initialize subnet service:", error);
    }
  } else {
    console.warn("[Subnet] ✗ Subnet service disabled (missing config)");
  }

  const server = app.listen(port, () => {
    console.log(`ZeroPrompt API listening on http://localhost:${port}`);
  });

  const shutdown = async () => {
    server.close();
    await subnetNodeService.shutdown();
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
