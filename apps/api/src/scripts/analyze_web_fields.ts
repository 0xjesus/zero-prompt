
import 'dotenv/config';

async function analyze() {
  try {
    console.log("Fetching OpenRouter models...");
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const json = await res.json();
    const models = json.data;

    // Known web-capable models (Perplexity)
    const webModels = models.filter((m: any) => m.id.toLowerCase().includes("sonar") || m.id.toLowerCase().includes("online"));
    
    // Known non-web models (DeepHermes, Jamba)
    const nonWebModels = models.filter((m: any) => 
        m.id === "nousresearch/deephermes-3-mistral-24b-preview" || 
        m.id === "ai21/jamba-large-1.7"
    );

    console.log(`
=== 🌍 KNOWN WEB MODELS (${webModels.length}) ===`);
    webModels.slice(0, 3).forEach((m: any) => {
        console.log(`
ID: ${m.id}`);
        console.log("Pricing:", JSON.stringify(m.pricing));
        console.log("Architecture:", JSON.stringify(m.architecture));
        console.log("Description:", m.description?.substring(0, 100));
    });

    console.log(`
=== ❌ KNOWN NON-WEB MODELS (${nonWebModels.length}) ===`);
    nonWebModels.forEach((m: any) => {
        console.log(`
ID: ${m.id}`);
        console.log("Pricing:", JSON.stringify(m.pricing));
        console.log("Architecture:", JSON.stringify(m.architecture));
        console.log("Description:", m.description?.substring(0, 100));
    });

  } catch (e) {
    console.error(e);
  }
}

analyze();
