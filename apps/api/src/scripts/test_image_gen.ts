/**
 * Test image generation to see how data comes from OpenRouter
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config();

async function listImageModels() {
    console.log("\n🔍 Checking available image generation models...\n");

    const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        }
    });

    const data = await response.json() as { data: any[] };
    const imageModels = data.data.filter((m: any) =>
        m.architecture?.output_modalities?.includes('image') ||
        m.id.includes('dall-e') ||
        m.id.includes('flux') ||
        m.id.includes('stable-diffusion') ||
        m.id.includes('ideogram') ||
        m.id.includes('imagen')
    );

    console.log(`Found ${imageModels.length} image generation models:`);
    imageModels.forEach((m: any) => {
        console.log(`  - ${m.id}`);
        console.log(`    output_modalities: ${JSON.stringify(m.architecture?.output_modalities)}`);
    });

    return imageModels[0]?.id;
}

async function testImageGeneration() {
    // First find available image models
    const availableModel = await listImageModels();

    // Use DALL-E-3 through OpenRouter (most reliable for image gen)
    const model = availableModel || "openai/dall-e-3";
    const prompt = "Generate an image of a nano banana (a tiny microscopic banana)";

    console.log(`\n🖼️  Testing Image Generation`);
    console.log(`Model: ${model}`);
    console.log(`Prompt: ${prompt}`);
    console.log("=".repeat(70));

    const payload = {
        model,
        messages: [{ role: "user", content: prompt }],
        stream: true,
        // modalities: ["text", "image"] // Some models need this
    };

    console.log("\nPayload:", JSON.stringify(payload, null, 2));

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://zeroprompt.app",
            "X-Title": "ZeroPrompt Test",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.text();
        console.error("❌ API Error:", response.status, error);
        return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
        console.error("❌ No reader");
        return;
    }

    let buffer = "";
    let chunkCount = 0;

    console.log("\n📡 Streaming response...\n");

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;

            if (trimmed.startsWith("data: ")) {
                try {
                    const parsed = JSON.parse(trimmed.slice(6));
                    chunkCount++;

                    // Log ALL chunks to see structure
                    console.log(`\n[Chunk ${chunkCount}]`);
                    console.log(JSON.stringify(parsed, null, 2).substring(0, 2000));

                    // Check for image data specifically
                    const delta = parsed.choices?.[0]?.delta;
                    if (delta) {
                        // Check various image formats
                        if (delta.image_url) {
                            console.log("\n🖼️ IMAGE_URL FOUND:", delta.image_url);
                        }
                        if (delta.images) {
                            console.log("\n🖼️ IMAGES ARRAY FOUND:", delta.images);
                        }
                        if (Array.isArray(delta.content)) {
                            console.log("\n🖼️ CONTENT IS ARRAY:", delta.content);
                            for (const part of delta.content) {
                                if (part.type === "image_url" || part.image_url) {
                                    console.log("   IMAGE PART:", part);
                                }
                            }
                        }
                        // Check if content contains base64
                        if (typeof delta.content === "string" && delta.content.includes("data:image")) {
                            console.log("\n🖼️ BASE64 IMAGE IN CONTENT (first 100 chars):", delta.content.substring(0, 100));
                        }
                    }

                    // Check message level
                    const message = parsed.choices?.[0]?.message;
                    if (message) {
                        console.log("\n📨 MESSAGE FOUND:", JSON.stringify(message, null, 2).substring(0, 500));
                    }

                } catch (e) {
                    // Skip parse errors
                }
            }
        }
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 Total chunks: ${chunkCount}`);
}

testImageGeneration().catch(console.error);
