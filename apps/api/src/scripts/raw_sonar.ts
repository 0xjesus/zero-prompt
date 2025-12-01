
import 'dotenv/config';

async function rawSonar() {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  const json = await res.json();
  const m = json.data.find((x: any) => x.id.includes("perplexity/sonar-pro-search"));
  console.log(JSON.stringify(m, null, 2));
}

rawSonar();
