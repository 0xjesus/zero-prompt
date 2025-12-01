// apps/api/src/scripts/analyze_extras.ts
export {};

async function run() {
  console.log("🔍 Hunting for hidden capabilities...");
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const json = await res.json();
    const models = json.data;

    const reasoningModels: any[] = [];
    const toolModels: any[] = [];
    const otherFeatures = new Set();

    models.forEach((m: any) => {
        const pricing = m.pricing || {};
        const arch = m.architecture || {};
        
        // 1. Reasoning (Chain of Thought)
        // Check pricing OR specific IDs (like o1, deepseek-r1)
        let isReasoning = false;
        if (pricing.internal_reasoning && parseFloat(pricing.internal_reasoning) > 0) isReasoning = true;
        if (m.id.includes("o1-") || m.id.includes("r1") || m.description?.toLowerCase().includes("reasoning")) isReasoning = true;

        if (isReasoning) {
            reasoningModels.push({ id: m.id, pricing: pricing.internal_reasoning });
        }

        // 2. Tool Calling (Native)
        // Look for 'tools' in instruct_type or modality
        if (arch.instruct_type === 'tool' || m.description?.toLowerCase().includes("function calling")) {
            toolModels.push(m.id);
        }

        // Collect other potential keys
        Object.keys(pricing).forEach(k => otherFeatures.add(k));
    });

    console.log(`\n🧠 Found ${reasoningModels.length} Reasoning Models (CoT):`);
    console.log(reasoningModels.slice(0, 10));

    console.log(`\n🛠️ Found ${toolModels.length} Native Tool Models:`);
    console.log(toolModels.slice(0, 5));

    console.log("\n💰 All Pricing Keys Found:", Array.from(otherFeatures));

  } catch (e) {
    console.error(e);
  }
}

run();
