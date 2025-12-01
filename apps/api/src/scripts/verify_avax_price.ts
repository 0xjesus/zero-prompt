
import 'dotenv/config';
import { fetch } from 'undici';

const MODEL_ID = "nousresearch/deephermes-3-mistral-24b-preview"; // The one from your logs
// const MODEL_ID = "perplexity/sonar-small-online"; // Fallback comparison if needed

async function run() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) { console.error("No API Key"); return; }

  console.log(`\n1. 🔍 Inspecting Model: ${MODEL_ID}`);
  try {
    const infoRes = await fetch("https://openrouter.ai/api/v1/models");
    const infoData: any = await infoRes.json();
    const modelInfo = infoData.data.find((m: any) => m.id === MODEL_ID);
    
    if (modelInfo) {
        console.log("   - Name:", modelInfo.name);
        console.log("   - Architecture:", JSON.stringify(modelInfo.architecture));
        console.log("   - Pricing:", JSON.stringify(modelInfo.pricing));
        
        // Check our backend logic detection
        const isNative = (modelInfo.architecture?.has_web_search) || 
                         MODEL_ID.includes("online") || 
                         MODEL_ID.includes("sonar") || 
                         MODEL_ID.includes("search");
        console.log(`   - ZeroPrompt Logic 'isNativeOnline': ${isNative}`);
    } else {
        console.log("   - ⚠️ Model not found in OpenRouter list!");
    }

    console.log(`\n2. 💬 Testing Query: "What is the current price of AVAX today?"`);
    const chatRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://zeroprompt.app",
            "X-Title": "ZeroPrompt Test"
        },
        body: JSON.stringify({
            model: MODEL_ID,
            messages: [{ role: "user", content: "What is the current price of AVAX (Avalanche) right now?" }]
        })
    });

    const chatData: any = await chatRes.json();
    const reply = chatData.choices?.[0]?.message?.content || "No response";
    console.log("\n--- RESPONSE ---");
    console.log(reply);
    console.log("----------------");

  } catch (e) {
      console.error("Error:", e);
  }
}

run();
