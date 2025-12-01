import { syncOpenRouterModels } from "../services/openrouterModels";
import { prisma } from "../prisma";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

async function main() {
  const result = await syncOpenRouterModels();
  console.log("Sync result:", result);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
