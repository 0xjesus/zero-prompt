
import 'dotenv/config';

async function checkJamba() {
  try {
    console.log("Fetching OpenRouter models...");
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const json = await res.json();
    const models = json.data;
    
    // Look for any model with 'jamba' in the ID
    const jambas = models.filter((m: any) => m.id.toLowerCase().includes("jamba"));
    
    console.log(`Found ${jambas.length} Jamba models.`);
    
    jambas.forEach((m: any) => {
        console.log("\n--------------------------------------------------");
        console.log(`ID: ${m.id}`);
        console.log(`Name: ${m.name}`);
        console.log("Pricing:", JSON.stringify(m.pricing, null, 2));
        console.log("Architecture:", JSON.stringify(m.architecture, null, 2));
        
        // Test our logic
        const isExplicitlyWebSearch = m.id.includes("sonar") || m.id.includes("search-preview") || m.id.includes("research");
        console.log(`>> Logic check: isExplicitlyWebSearch = ${isExplicitlyWebSearch}`);
    });

  } catch (e) {
    console.error(e);
  }
}

checkJamba();
