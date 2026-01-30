import { EventEmitter } from "events";

/**
 * OllamaService - Manages connections to decentralized Ollama nodes
 * Handles node selection, health checks, and streaming chat completions
 */

export interface OllamaNode {
  address: string;
  endpoint: string;
  supportedModels: string[];
  isHealthy: boolean;
  lastHealthCheck: Date;
  latencyMs: number;
  performanceScore: number;
  stakeWeight: number;
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

class OllamaService extends EventEmitter {
  private nodes: Map<string, OllamaNode> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly REQUEST_TIMEOUT = 60000; // 60 seconds

  constructor() {
    super();
  }

  /**
   * Initialize the service with operators from the subnet
   */
  async initialize(operators: OllamaNode[]): Promise<void> {
    for (const op of operators) {
      this.nodes.set(op.address, {
        ...op,
        isHealthy: false,
        lastHealthCheck: new Date(0),
        latencyMs: 0,
      });
    }

    // Run initial health checks
    await this.runHealthChecks();
  }

  /**
   * Update the list of operators (called when blockchain state changes)
   */
  updateOperators(operators: OllamaNode[]): void {
    // Remove operators that are no longer active
    const activeAddresses = new Set(operators.map((o) => o.address));
    for (const addr of this.nodes.keys()) {
      if (!activeAddresses.has(addr)) {
        this.nodes.delete(addr);
      }
    }

    // Add/update operators
    for (const op of operators) {
      const existing = this.nodes.get(op.address);
      if (existing) {
        // Preserve health check data
        this.nodes.set(op.address, {
          ...op,
          isHealthy: existing.isHealthy,
          lastHealthCheck: existing.lastHealthCheck,
          latencyMs: existing.latencyMs,
        });
      } else {
        this.nodes.set(op.address, {
          ...op,
          isHealthy: false,
          lastHealthCheck: new Date(0),
          latencyMs: 0,
        });
      }
    }
  }

  /**
   * Select the best available node for a given model
   * Selection is based on: health, latency, performance score, and stake weight
   */
  selectNode(model: string): OllamaNode | null {
    const eligibleNodes: OllamaNode[] = [];

    for (const node of this.nodes.values()) {
      if (!node.isHealthy) continue;
      if (!node.supportedModels.includes(model)) continue;
      eligibleNodes.push(node);
    }

    if (eligibleNodes.length === 0) {
      return null;
    }

    // Sort by composite score (higher is better)
    // Score = performanceScore * stakeWeight / (1 + latencyMs/1000)
    eligibleNodes.sort((a, b) => {
      const scoreA =
        (a.performanceScore * a.stakeWeight) / (1 + a.latencyMs / 1000);
      const scoreB =
        (b.performanceScore * b.stakeWeight) / (1 + b.latencyMs / 1000);
      return scoreB - scoreA;
    });

    // Weighted random selection among top 3 nodes to distribute load
    const topNodes = eligibleNodes.slice(0, 3);
    const totalWeight = topNodes.reduce(
      (sum, n) => sum + n.performanceScore * n.stakeWeight,
      0
    );
    let random = Math.random() * totalWeight;

    for (const node of topNodes) {
      random -= node.performanceScore * node.stakeWeight;
      if (random <= 0) {
        return node;
      }
    }

    return topNodes[0];
  }

  /**
   * Streaming chat completion with an Ollama node
   */
  async *chatCompletion(
    node: OllamaNode,
    messages: OllamaMessage[],
    model: string
  ): AsyncGenerator<{
    content?: string;
    done?: boolean;
    error?: string;
    totalDuration?: number;
    evalCount?: number;
  }> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.REQUEST_TIMEOUT
      );

      const response = await fetch(`${node.endpoint}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        yield { error: `Ollama API error: ${response.status} - ${errorText}` };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { error: "No response body" };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Ollama sends newline-delimited JSON
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line);

            if (parsed.message?.content) {
              yield { content: parsed.message.content };
            }

            if (parsed.done) {
              yield {
                done: true,
                totalDuration: parsed.total_duration,
                evalCount: parsed.eval_count,
              };
            }
          } catch (e) {
            console.error("[Ollama] Failed to parse line:", line, e);
          }
        }
      }

      // Update node latency
      const latency = Date.now() - startTime;
      node.latencyMs = Math.round((node.latencyMs + latency) / 2); // Running average
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        yield { error: "Request timeout" };
      } else {
        yield { error: `Request failed: ${(error as Error).message}` };
      }

      // Mark node as unhealthy on error
      node.isHealthy = false;
    }
  }

  /**
   * Non-streaming chat completion
   */
  async chatCompletionSync(
    node: OllamaNode,
    messages: OllamaMessage[],
    model: string
  ): Promise<{ content: string; totalDuration?: number; evalCount?: number }> {
    let fullContent = "";
    let metadata: { totalDuration?: number; evalCount?: number } = {};

    for await (const chunk of this.chatCompletion(node, messages, model)) {
      if (chunk.error) {
        throw new Error(chunk.error);
      }
      if (chunk.content) {
        fullContent += chunk.content;
      }
      if (chunk.done) {
        metadata = {
          totalDuration: chunk.totalDuration,
          evalCount: chunk.evalCount,
        };
      }
    }

    return { content: fullContent, ...metadata };
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.runHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL);

    console.log(
      "[Ollama] Health checks started (interval: " +
        this.HEALTH_CHECK_INTERVAL / 1000 +
        "s)"
    );
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Run health checks on all nodes
   */
  private async runHealthChecks(): Promise<void> {
    const checks: Promise<void>[] = [];

    for (const [address, node] of this.nodes) {
      checks.push(this.checkNodeHealth(address, node));
    }

    await Promise.allSettled(checks);
    this.emit("healthChecksComplete", this.getHealthySummary());
  }

  /**
   * Check health of a single node
   */
  private async checkNodeHealth(
    address: string,
    node: OllamaNode
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(`${node.endpoint}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        node.isHealthy = false;
        console.log(`[Ollama] Node ${address} unhealthy: HTTP ${response.status}`);
        return;
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      node.isHealthy = true;
      node.lastHealthCheck = new Date();
      node.latencyMs = latency;

      // Update supported models from actual node response
      if (data.models && Array.isArray(data.models)) {
        const modelNames = data.models.map(
          (m: { name: string }) => m.name.split(":")[0]
        );
        node.supportedModels = modelNames;
      }

      this.emit("nodeHealthy", address, node);
    } catch (error) {
      node.isHealthy = false;
      node.lastHealthCheck = new Date();
      console.log(
        `[Ollama] Node ${address} health check failed:`,
        (error as Error).message
      );
      this.emit("nodeUnhealthy", address, node);
    }
  }

  /**
   * Get summary of healthy nodes
   */
  getHealthySummary(): {
    total: number;
    healthy: number;
    models: Set<string>;
  } {
    let healthy = 0;
    const models = new Set<string>();

    for (const node of this.nodes.values()) {
      if (node.isHealthy) {
        healthy++;
        node.supportedModels.forEach((m) => models.add(m));
      }
    }

    return { total: this.nodes.size, healthy, models };
  }

  /**
   * Get all nodes
   */
  getAllNodes(): OllamaNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get healthy nodes
   */
  getHealthyNodes(): OllamaNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.isHealthy);
  }

  /**
   * Get available models across all healthy nodes
   */
  getAvailableModels(): string[] {
    const models = new Set<string>();
    for (const node of this.nodes.values()) {
      if (node.isHealthy) {
        node.supportedModels.forEach((m) => models.add(m));
      }
    }
    return Array.from(models).sort();
  }

  /**
   * Check if a specific model is available
   */
  isModelAvailable(model: string): boolean {
    for (const node of this.nodes.values()) {
      if (node.isHealthy && node.supportedModels.includes(model)) {
        return true;
      }
    }
    return false;
  }
}

// Singleton instance
export const ollamaService = new OllamaService();
