async function test() {
    const prompt = process.argv[2] || "/image a cute robot";
    console.log("Testing prompt:", prompt);
    
    try {
        const res = await fetch("http://localhost:3001/llm/chat", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-guest-id": "test-script" 
            },
            body: JSON.stringify({
                model: "openai/gpt-3.5-turbo", // Model doesn't matter for tools
                messages: [{ role: "user", content: prompt }]
            })
        });
        
        const json = await res.json();
        console.log("Response:", JSON.stringify(json, null, 2));
        
        if (json.attachmentUrl) {
            console.log("✅ Attachment URL found:", json.attachmentUrl);
        } else {
            console.log("❌ No attachment URL returned.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

test();