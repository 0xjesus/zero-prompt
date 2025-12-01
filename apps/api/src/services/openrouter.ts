type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

type ChatCompletionInput = {
  messages: ChatMessage[];
  model?: string;
};

const baseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const defaultModel = process.env.OPENROUTER_MODEL; // optional; prefer DB-provided model
const apiKey = process.env.OPENROUTER_API_KEY;
const referer = process.env.APP_URL || "http://localhost";
const title = "ZeroPrompt";

export type OpenRouterModel = {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
    image?: string;  // For image generation models
  };
  architecture?: {
    modality?: string;  // e.g., "text->text", "text->image"
  };
};

export async function getModels(): Promise<OpenRouterModel[]> {
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      "Content-Type": "application/json",
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  const data = await response.json() as { data: OpenRouterModel[] };
  return data.data || [];
}

export async function chatCompletion(input: ChatCompletionInput): Promise<string> {
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const targetModel = input.model || defaultModel;
  if (!targetModel) {
    throw new Error("Model required (provide one from the DB)");
  }

  const payload = {
    model: targetModel,
    messages: input.messages
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": referer,
      "X-Title": title
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  return data.choices?.[0]?.message?.content || "";
}
