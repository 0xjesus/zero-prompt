import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Using correct ID from OpenRouter docs if possible, or checking 'ai21/jamba-large-1.7'
const TARGET_MODEL = "ai21/jamba-large-1.7"; 

async function testConfig(name: string, extraBody: any) {
    console.log(`\n--- Testing: ${name} ---`);
    try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://test.local",
            },
            body: JSON.stringify({
                model: TARGET_MODEL,
                messages: [{ role: "user", content: "What is the price of Bitcoin right now? Check online." }],
                stream: false,
                ...extraBody
            })
        });

        if (!res.ok) {
            const err = await res.text();
            console.log(`❌ Failed (${res.status}):`, err);
            return;
        }

        const data = await res.json();
        console.log("✅ Success!");
        console.log("Response:", data.choices[0].message.content.substring(0, 100) + "...");
        
        // Check for citations or grounding
        if (JSON.stringify(data).includes("citation") || data.choices[0].message.content.includes("2024") || data.choices[0].message.content.includes("2025")) {
            console.log("⭐ Seems to have searched!");
        } else {
            console.log("⚠️ Probably hallucinated or used internal knowledge.");
        }

    } catch (e) {
        console.error("Crash:", e);
    }
}

async function run() {
    console.log("Targeting Model:", TARGET_MODEL);
    
    // 1. Baseline
    await testConfig("Baseline (No extras)", {});

    // 2. Web Search Plugin (Deprecated but sometimes works)
    await testConfig("Plugin: web_search", { plugins: [{ id: "web_search" }] });

    // 3. Provider Flags
    await testConfig("Provider: require_parameters", { 
        provider: { require_parameters: true },
        plugins: [{ id: "web_search" }]
    });
}

run();
