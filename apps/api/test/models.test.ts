import { describe, expect, it, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => {
  const modelStore: any[] = [];
  return {
    model: {
      findMany: async ({ where }: any = {}) => {
        if (where?.isActive) return modelStore.filter((m) => m.isActive);
        return modelStore;
      },
      upsert: async ({ where, create, update }: any) => {
        const idx = modelStore.findIndex((m) => m.openrouterId === where.openrouterId);
        if (idx >= 0) {
          modelStore[idx] = { ...modelStore[idx], ...update };
          return modelStore[idx];
        }
        const created = {
          id: modelStore.length + 1,
          ...create
        };
        modelStore.push(created);
        return created;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        modelStore.forEach((m, i) => {
          if (!where.openrouterId.notIn.includes(m.openrouterId)) {
            modelStore[i] = { ...m, ...data };
            count += 1;
          }
        });
        return { count };
      },
      deleteMany: async () => {
        const count = modelStore.length;
        modelStore.splice(0, modelStore.length);
        return { count };
      }
    },
    prompt: {
      findMany: async () => [],
      create: async () => ({}),
      deleteMany: async () => ({ count: 0 })
    }
  };
});

vi.mock("../src/prisma", () => ({ prisma: prismaMock }));
import { syncOpenRouterModels } from "../src/services/openrouterModels";

describe("OpenRouter model sync", () => {
  beforeEach(async () => {
    await prismaMock.model.deleteMany({});
    vi.stubGlobal("fetch", vi.fn());
  });

  it("upserts models and deactivates missing ones", async () => {
    const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: "openrouter/fast",
            name: "Fast Model",
            description: "speedy",
            context_length: 2048,
            pricing: { prompt: "0.001", completion: "0.002" },
            tags: ["fast"]
          }
        ]
      })
    } as any);

    let result = await syncOpenRouterModels();
    expect(result.upserted).toBe(1);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] })
    } as any);
    result = await syncOpenRouterModels();
    expect(result.deactivated).toBe(1);

    const models = await prismaMock.model.findMany();
    expect(models[0].isActive).toBe(false);
    expect(models[0].publicPricingPrompt).toBe(0.0017);
    expect(models[0].publicPricingCompletion).toBe(0.0034);
  });
});
