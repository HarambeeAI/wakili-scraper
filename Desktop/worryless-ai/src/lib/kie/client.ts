const KIE_BASE_URL = "https://api.kie.ai";

interface KieTaskResponse {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  output?: { url?: string; urls?: string[] };
  error?: string;
}

export class KieClient {
  private apiKey: string;

  constructor() {
    const key = process.env.KIE_API_KEY;
    if (!key) throw new Error("KIE_API_KEY not set");
    this.apiKey = key;
  }

  async request(endpoint: string, body: Record<string, unknown>): Promise<KieTaskResponse> {
    const res = await fetch(`${KIE_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`KIE API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async pollForResult(taskId: string, maxWaitMs = 120_000): Promise<string> {
    const startTime = Date.now();
    const pollInterval = 3_000;
    while (Date.now() - startTime < maxWaitMs) {
      const res = await fetch(`${KIE_BASE_URL}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) throw new Error(`KIE poll error ${res.status}`);
      const data: KieTaskResponse = await res.json();
      if (data.status === "completed") {
        const url = data.output?.url || data.output?.urls?.[0];
        if (!url) throw new Error("KIE task completed but no output URL");
        return url;
      }
      if (data.status === "failed") {
        throw new Error(`KIE task failed: ${data.error || "unknown error"}`);
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    throw new Error(`KIE task ${taskId} timed out after ${maxWaitMs}ms`);
  }
}

export const kieClient = new KieClient();
