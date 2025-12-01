import cron from "node-cron";
import { syncOpenRouterModels } from "../services/openrouterModels";

export function startModelSyncCron() {
  const cronExp = process.env.MODEL_SYNC_CRON || "0 3 * * *"; // daily at 3am
  const enabled = process.env.DISABLE_MODEL_SYNC === "1" ? false : true;

  if (!enabled) {
    console.log("Model sync cron disabled via DISABLE_MODEL_SYNC=1");
    return;
  }

  cron.schedule(cronExp, async () => {
    try {
      const result = await syncOpenRouterModels();
      console.log("[model-sync] success", result);
    } catch (err) {
      console.error("[model-sync] error", err);
    }
  });

  console.log(`Model sync cron scheduled (${cronExp})`);
}
