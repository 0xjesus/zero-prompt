
import { config } from 'dotenv';
import { fetch } from 'undici';
import path from 'path';

// Load .env from project root
config({ path: path.resolve(__dirname, '../../../../.env') });

const apiKey = process.env.OPENROUTER_API_KEY;
const baseUrl = "https://openrouter.ai/api/v1";

// Test query for real-time data
const TEST_QUERY = "What is the current price of AVAX (Avalanche cryptocurrency) today? Please give me the exact current price in USD.";
const EXPECTED_PRICE_RANGE = { min: 10, max: 20 }; // AVAX ~$13 USD

interface TestResult {
  provider: string;
  model: string;
  method: string;
  responseTime: number;
  content: string;
  sources: string[];
  mentionedPrice: string | null;
  success: boolean;
  error?: string;
}

// Extract price from response text
function extractPrice(text: string): string | null {
  // Look for patterns like "$13", "$13.50", "13 USD", "13.50 USD", etc.
  const patterns = [
    /\$(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s*(?:USD|usd|dollars?)/,
    /approximately\s*\$?(\d+(?:\.\d+)?)/i,
    /around\s*\$?(\d+(?:\.\d+)?)/i,
    /price[:\s]+\$?(\d+(?:\.\d+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const price = parseFloat(match[1]);
      // Filter out unrealistic prices (year numbers, percentages, etc.)
      if (price > 1 && price < 1000) {
        return `$${match[1]}`;
      }
    }
  }
  return null;
}

// Test 1: Perplexity Sonar (Native Web Search)
async function testPerplexitySonar(): Promise<TestResult> {
  const model = "perplexity/sonar-pro";
  const start = Date.now();

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zeroprompt.app",
        "X-Title": "ZeroPrompt Web Search Test"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: TEST_QUERY }],
        stream: false
      })
    });

    const data: any = await res.json();
    const responseTime = Date.now() - start;

    if (data.error) {
      return {
        provider: "Perplexity",
        model,
        method: "Native (built-in web search)",
        responseTime,
        content: "",
        sources: [],
        mentionedPrice: null,
        success: false,
        error: data.error.message || JSON.stringify(data.error)
      };
    }

    const content = data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];

    return {
      provider: "Perplexity",
      model,
      method: "Native (built-in web search)",
      responseTime,
      content,
      sources: citations,
      mentionedPrice: extractPrice(content),
      success: true
    };
  } catch (e: any) {
    return {
      provider: "Perplexity",
      model,
      method: "Native",
      responseTime: Date.now() - start,
      content: "",
      sources: [],
      mentionedPrice: null,
      success: false,
      error: e.message
    };
  }
}

// Test 2: GPT-4o with Exa Plugin (via OpenRouter plugins)
async function testGPT4oWithExa(): Promise<TestResult> {
  const model = "openai/gpt-4o";
  const start = Date.now();

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zeroprompt.app",
        "X-Title": "ZeroPrompt Web Search Test"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: TEST_QUERY }],
        plugins: [{ id: "web" }], // Exa fallback
        stream: false
      })
    });

    const data: any = await res.json();
    const responseTime = Date.now() - start;

    if (data.error) {
      return {
        provider: "OpenAI + Exa",
        model,
        method: "Exa Plugin (plugins: [{id: 'web'}])",
        responseTime,
        content: "",
        sources: [],
        mentionedPrice: null,
        success: false,
        error: data.error.message || JSON.stringify(data.error)
      };
    }

    const content = data.choices?.[0]?.message?.content || "";
    // Exa sources come in annotations
    const annotations = data.choices?.[0]?.message?.annotations || [];
    const sources = annotations
      .filter((a: any) => a.type === 'url_citation' && a.url_citation?.url)
      .map((a: any) => a.url_citation.url);

    return {
      provider: "OpenAI + Exa",
      model,
      method: "Exa Plugin (plugins: [{id: 'web'}])",
      responseTime,
      content,
      sources,
      mentionedPrice: extractPrice(content),
      success: true
    };
  } catch (e: any) {
    return {
      provider: "OpenAI + Exa",
      model,
      method: "Exa Plugin",
      responseTime: Date.now() - start,
      content: "",
      sources: [],
      mentionedPrice: null,
      success: false,
      error: e.message
    };
  }
}

// Test 3: Claude with Exa Plugin
async function testClaudeWithExa(): Promise<TestResult> {
  const model = "anthropic/claude-3.5-sonnet";
  const start = Date.now();

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zeroprompt.app",
        "X-Title": "ZeroPrompt Web Search Test"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: TEST_QUERY }],
        plugins: [{ id: "web" }],
        stream: false
      })
    });

    const data: any = await res.json();
    const responseTime = Date.now() - start;

    if (data.error) {
      return {
        provider: "Anthropic + Exa",
        model,
        method: "Exa Plugin (plugins: [{id: 'web'}])",
        responseTime,
        content: "",
        sources: [],
        mentionedPrice: null,
        success: false,
        error: data.error.message || JSON.stringify(data.error)
      };
    }

    const content = data.choices?.[0]?.message?.content || "";
    const annotations = data.choices?.[0]?.message?.annotations || [];
    const sources = annotations
      .filter((a: any) => a.type === 'url_citation' && a.url_citation?.url)
      .map((a: any) => a.url_citation.url);

    return {
      provider: "Anthropic + Exa",
      model,
      method: "Exa Plugin (plugins: [{id: 'web'}])",
      responseTime,
      content,
      sources,
      mentionedPrice: extractPrice(content),
      success: true
    };
  } catch (e: any) {
    return {
      provider: "Anthropic + Exa",
      model,
      method: "Exa Plugin",
      responseTime: Date.now() - start,
      content: "",
      sources: [],
      mentionedPrice: null,
      success: false,
      error: e.message
    };
  }
}

// Test 4: OpenAI GPT-4o with Native Web Search
async function testGPT4oNative(): Promise<TestResult> {
  const model = "openai/gpt-4o";
  const start = Date.now();

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zeroprompt.app",
        "X-Title": "ZeroPrompt Web Search Test"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: TEST_QUERY }],
        web_search_options: {
          search_context_size: "medium"
        },
        stream: false
      })
    });

    const data: any = await res.json();
    const responseTime = Date.now() - start;

    if (data.error) {
      return {
        provider: "OpenAI Native",
        model,
        method: "Native web_search_options",
        responseTime,
        content: "",
        sources: [],
        mentionedPrice: null,
        success: false,
        error: data.error.message || JSON.stringify(data.error)
      };
    }

    const content = data.choices?.[0]?.message?.content || "";
    const annotations = data.choices?.[0]?.message?.annotations || [];
    const sources = annotations
      .filter((a: any) => a.type === 'url_citation' && a.url_citation?.url)
      .map((a: any) => a.url_citation.url);

    return {
      provider: "OpenAI Native",
      model,
      method: "Native web_search_options",
      responseTime,
      content,
      sources,
      mentionedPrice: extractPrice(content),
      success: true
    };
  } catch (e: any) {
    return {
      provider: "OpenAI Native",
      model,
      method: "Native web_search_options",
      responseTime: Date.now() - start,
      content: "",
      sources: [],
      mentionedPrice: null,
      success: false,
      error: e.message
    };
  }
}

function printResult(result: TestResult, index: number) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`TEST ${index}: ${result.provider}`);
  console.log(`${"=".repeat(80)}`);
  console.log(`Model:          ${result.model}`);
  console.log(`Method:         ${result.method}`);
  console.log(`Response Time:  ${result.responseTime}ms`);
  console.log(`Status:         ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);

  if (result.error) {
    console.log(`Error:          ${result.error}`);
  }

  if (result.success) {
    console.log(`\n📊 PRICE EXTRACTED: ${result.mentionedPrice || 'NOT FOUND'}`);

    const priceNum = result.mentionedPrice ? parseFloat(result.mentionedPrice.replace('$', '')) : 0;
    if (priceNum >= EXPECTED_PRICE_RANGE.min && priceNum <= EXPECTED_PRICE_RANGE.max) {
      console.log(`   ✅ Price is in expected range ($${EXPECTED_PRICE_RANGE.min}-$${EXPECTED_PRICE_RANGE.max})`);
    } else if (priceNum > 0) {
      console.log(`   ⚠️ Price outside expected range - might be outdated data`);
    }

    console.log(`\n📚 SOURCES (${result.sources.length}):`);
    if (result.sources.length > 0) {
      result.sources.slice(0, 5).forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
      if (result.sources.length > 5) {
        console.log(`   ... and ${result.sources.length - 5} more`);
      }
    } else {
      console.log(`   (No sources returned)`);
    }

    console.log(`\n📝 RESPONSE PREVIEW (first 500 chars):`);
    console.log(`   ${result.content.substring(0, 500).replace(/\n/g, '\n   ')}...`);
  }
}

async function runComparison() {
  console.log("\n" + "█".repeat(80));
  console.log("  WEB SEARCH COMPARISON: Exa Plugin vs Native Search");
  console.log("  Query: \"" + TEST_QUERY + "\"");
  console.log("  Expected AVAX Price: ~$" + EXPECTED_PRICE_RANGE.min + "-$" + EXPECTED_PRICE_RANGE.max);
  console.log("█".repeat(80));

  if (!apiKey) {
    console.error("\n❌ OPENROUTER_API_KEY not found in environment!");
    return;
  }

  const results: TestResult[] = [];

  // Run tests sequentially to avoid rate limits
  console.log("\n⏳ Running Test 1: Perplexity Sonar (Native)...");
  results.push(await testPerplexitySonar());

  console.log("⏳ Running Test 2: OpenAI GPT-4o with Native Web Search...");
  results.push(await testGPT4oNative());

  console.log("⏳ Running Test 3: OpenAI GPT-4o + Exa Plugin...");
  results.push(await testGPT4oWithExa());

  console.log("⏳ Running Test 4: Claude 3.5 Sonnet + Exa Plugin...");
  results.push(await testClaudeWithExa());

  // Print results
  results.forEach((r, i) => printResult(r, i + 1));

  // Summary
  console.log("\n" + "█".repeat(80));
  console.log("  SUMMARY");
  console.log("█".repeat(80));

  const successResults = results.filter(r => r.success);
  const withSources = successResults.filter(r => r.sources.length > 0);
  const withPrice = successResults.filter(r => r.mentionedPrice);

  console.log(`\nTotal Tests:     ${results.length}`);
  console.log(`Successful:      ${successResults.length}`);
  console.log(`With Sources:    ${withSources.length}`);
  console.log(`Found Price:     ${withPrice.length}`);

  console.log("\n📈 Response Time Ranking (fastest first):");
  successResults
    .sort((a, b) => a.responseTime - b.responseTime)
    .forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.provider}: ${r.responseTime}ms`);
    });

  console.log("\n📚 Source Count Ranking:");
  successResults
    .sort((a, b) => b.sources.length - a.sources.length)
    .forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.provider}: ${r.sources.length} sources`);
    });

  console.log("\n💰 Price Accuracy:");
  withPrice.forEach(r => {
    const priceNum = parseFloat(r.mentionedPrice!.replace('$', ''));
    const inRange = priceNum >= EXPECTED_PRICE_RANGE.min && priceNum <= EXPECTED_PRICE_RANGE.max;
    console.log(`   ${r.provider}: ${r.mentionedPrice} ${inRange ? '✅' : '⚠️'}`);
  });

  console.log("\n" + "█".repeat(80));
  console.log("  CONCLUSION");
  console.log("█".repeat(80));

  const bestOverall = successResults.find(r => r.sources.length > 0 && r.mentionedPrice);
  if (bestOverall) {
    console.log(`\n🏆 Best Result: ${bestOverall.provider}`);
    console.log(`   - ${bestOverall.responseTime}ms response time`);
    console.log(`   - ${bestOverall.sources.length} sources`);
    console.log(`   - Found price: ${bestOverall.mentionedPrice}`);
  }
}

runComparison().catch(console.error);
