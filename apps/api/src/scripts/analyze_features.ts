// apps/api/src/scripts/analyze_features.ts
export {};

async function run() {
  console.log("🔍 Analyzing OpenRouter features...");
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const json = await res.json();
    const models = json.data;

    const webSearchModels: any[] = [];
    const toolModels: string[] = [];

    models.forEach((m: any) => {
        const pricing = m.pricing || {};
        const arch = m.architecture || {};
        
        // Check for Web Search
        // 1. Explicit pricing for web_search
        // 2. 'online' in ID
        // 3. Description mentions it
        let hasWeb = false;
        if (pricing.web_search && parseFloat(pricing.web_search) > 0) hasWeb = true;
        if (m.id.includes("online") || m.id.includes("search")) hasWeb = true;
        
        if (hasWeb) {
            webSearchModels.push({
                id: m.id,
                pricing: pricing.web_search,
                modality: arch.modality
            });
        }

        // Check for generic tools support in architecture
        if (arch.instruct_type && arch.instruct_type.includes("tool")) {
            toolModels.push(m.id);
        }
    });

    console.log(`\n🌍 Found ${webSearchModels.length} Web Search Models:`);
    console.log(webSearchModels.slice(0, 10)); // Show top 10

    console.log(`\n🛠️ Found ${toolModels.length} Tool-Tuned Models (generic):`);
    console.log(toolModels.slice(0, 5));

  } catch (e) {
    console.error(e);
  }
}

run();
