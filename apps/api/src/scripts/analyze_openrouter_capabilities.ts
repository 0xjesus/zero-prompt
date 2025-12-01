// Simple script to analyze OpenRouter models
// Run with: npx ts-node src/scripts/analyze_openrouter_capabilities.ts

export {};

async function analyze() {
  console.log("Fetching OpenRouter models...");
  
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) throw new Error("HTTP Error " + res.status);
    
    const json = await res.json();
    const models: any[] = json.data;

    console.log("Fetched " + models.length + " models.");

    const modalities: Record<string, number> = {};
    const imageModels: string[] = [];

    models.forEach((m: any) => {
        // Check architecture.modality
        const mod = m.architecture ? m.architecture.modality : "unknown";
        modalities[mod] = (modalities[mod] || 0) + 1;

        if (mod && mod.indexOf("image") !== -1) {
            imageModels.push(m.id);
        }
    });

    console.log("--- Modalities ---");
    console.log(JSON.stringify(modalities, null, 2));

    console.log("--- Image Capable Models (Native) ---");
    console.log(imageModels.join("\n"));

    // Print one full example to see structure
    console.log("--- Example Model ---");
    console.log(JSON.stringify(models[0], null, 2));

  } catch (err) {
    console.error("Error:", err);
  }
}

analyze();