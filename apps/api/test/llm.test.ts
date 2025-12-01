import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  prompt: {
    findMany: async () => [],
    create: async () => ({}),
    deleteMany: async () => ({ count: 0 })
  },
  model: {
    findMany: async () => [],
    upsert: async () => ({}),
    updateMany: async () => ({ count: 0 })
  }
}));

vi.mock("../src/prisma", () => ({ prisma: prismaMock }));
import { createApp } from "../src/app";
const app = createApp();

describe("llm chat endpoint", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // simple fetch mock
    vi.stubGlobal("fetch", vi.fn());
    // ensure env present
    process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "test-key";
    process.env.OPENROUTER_BASE_URL = "https://openrouter.test/api/v1";
  });

  it("validates messages", async () => {
    const res = await request(app).post("/llm/chat").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("messages_required");
  });

  it("returns assistant reply from OpenRouter", async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "Hello anon, privacy on." } }]
      })
    } as any);

    const res = await request(app)
      .post("/llm/chat")
      .send({
        messages: [{ role: "user", content: "hi" }],
        model: "openai/gpt-3.5-turbo"
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe("Hello anon, privacy on.");
    expect(mockFetch).toHaveBeenCalled();
  });
});
