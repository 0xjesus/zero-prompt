import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function listModels() {
    console.log("Fetching models from OpenRouter...");
    try {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://zero-prompt-dev.local",
                "X-Title": "ZeroPrompt Debugger",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch models: ${response.status} ${errorText}`);
            return;
        }

        const data = await response.json();
        
        console.log("\n--- Available Models on OpenRouter ---");
        const jambaModels: any[] = [];
        const webSearchModels: any[] = [];

        data.data.forEach((model: any) => {
            const modelId = model.id.toLowerCase();
            if (modelId.includes("jamba")) {
                jambaModels.push(model);
            }
            if (modelId.includes("online") || modelId.includes("search") || modelId.includes("sonar") || (model.architecture && (model.architecture.has_web_search || model.architecture.input_modalities?.includes("web_search")))) {
                webSearchModels.push(model);
            }
        });

        console.log("\n--- Jamba Models ---");
        if (jambaModels.length > 0) {
            jambaModels.forEach(model => {
                console.log(`ID: ${model.id}, Name: ${model.name}`);
            });
        } else {
            console.log("No Jamba models found.");
        }

        console.log("\n--- Web Search Capable Models (by ID or architecture hint) ---");
        if (webSearchModels.length > 0) {
            webSearchModels.forEach(model => {
                console.log(`ID: ${model.id}, Name: ${model.name}, Arch: ${JSON.stringify(model.architecture)}`);
            });
        } else {
            console.log("No explicit web search models found or detected.");
        }

        console.log("\n--- Full Model List (first 10, for brevity) ---");
        data.data.slice(0, 10).forEach((model: any) => {
            console.log(`ID: ${model.id}, Name: ${model.name}`);
        });

    } catch (e) {
        console.error("Error listing models:", e);
    }
}

listModels();
