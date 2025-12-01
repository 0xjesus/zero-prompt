import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

// Load root .env for dev/test (single env file at repo root)
const rootEnvPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: rootEnvPath });
dotenv.config(); // fallback to local env if provided

export const prisma = new PrismaClient();
