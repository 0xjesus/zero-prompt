
import 'dotenv/config';

async function rawHaiku() {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  const json = await res.json();
  const m = json.data.find((x: any) => x.id === "anthropic/claude-3.5-haiku");
  console.log(JSON.stringify(m, null, 2));
}

rawHaiku();
