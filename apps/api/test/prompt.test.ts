import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const promptStore: any[] = [];
  return {
    prompt: {
      findMany: async () =>
        promptStore
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 20),
      create: async ({ data }: any) => {
        const prompt = {
          id: promptStore.length + 1,
          title: data.title,
          body: data.body,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        promptStore.push(prompt);
        return prompt;
      },
      deleteMany: async () => {
        const count = promptStore.length;
        promptStore.splice(0, promptStore.length);
        return { count };
      }
    },
    model: {
      findMany: async () => [],
      upsert: async () => ({}),
      updateMany: async () => ({ count: 0 })
    }
  };
});

vi.mock("../src/prisma", () => ({ prisma: prismaMock }));
import { createApp } from "../src/app";
const app = createApp();

describe("prompts API", () => {
  beforeEach(async () => {
    await prismaMock.prompt.deleteMany({});
  });

  it("returns empty list initially", async () => {
    const res = await request(app).get("/prompts");
    expect(res.status).toBe(200);
    expect(res.body.prompts).toEqual([]);
  });

  it("creates a prompt", async () => {
    const res = await request(app)
      .post("/prompts")
      .send({ title: "Hello", body: "World" });

    expect(res.status).toBe(201);
    expect(res.body.prompt.title).toBe("Hello");
    expect(res.body.prompt.body).toBe("World");
  });

  it("validates payload", async () => {
    const res = await request(app).post("/prompts").send({ title: "Missing" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("title_and_body_required");
  });
});
