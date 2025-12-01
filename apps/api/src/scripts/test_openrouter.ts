// apps/api/src/scripts/test_openrouter.ts
// Run with: npx ts-node src/scripts/test_openrouter.ts

export {};

async function run() {
  console.log("📡 Connecting to OpenRouter API...");
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    const json = await response.json();
    const models = json.data;

    console.log(`✅ Loaded ${models.length} models.`);

    // 1. Analyze Modalities
    const modalities = new Set();
    const imageModels: string[] = [];

    models.forEach((m: any) => {
      const mod = m.architecture?.modality || "text-only";
      modalities.add(mod);
      if (mod.includes("image") || m.description?.toLowerCase().includes("multimodal")) {
        imageModels.push(m.id);
      }
    });

    console.log("\n📊 Detected Modalities:", Array.from(modalities));
    console.log(`🖼️ Models with Native Image Support: ${imageModels.length}`);
    console.log("Sample IDs:", imageModels.slice(0, 5));

    // 2. Check Pricing Structure of the first model
    console.log("\n💰 Pricing Structure Example:");
    console.log(JSON.stringify(models[0].pricing, null, 2));

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

run();
