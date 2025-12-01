import { config } from "dotenv";
import path from "path";
import fs from "fs";

const rootEnv = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnv)) {
  config({ path: rootEnv });
}

const testEnv = path.resolve(__dirname, ".env.test");
if (fs.existsSync(testEnv)) {
  config({ path: testEnv, override: true });
}
