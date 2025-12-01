import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { createApp } from "./app";
import { prisma } from "./prisma";
import { startModelSyncCron } from "./jobs/modelSyncCron";

const port = parseInt(process.env.PORT || "3001", 10);

async function start() {
  const app = createApp();

  startModelSyncCron();

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
