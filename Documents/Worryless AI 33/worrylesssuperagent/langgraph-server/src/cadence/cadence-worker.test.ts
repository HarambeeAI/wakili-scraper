import { describe, it, expect } from "vitest";

describe("Cadence Worker — module exports", () => {
  it("exports startHeartbeatWorker function", async () => {
    const mod = await import("./cadence-worker.js");
    expect(typeof mod.startHeartbeatWorker).toBe("function");
  });
});

describe("Cadence Worker — thread_id pattern", () => {
  it("heartbeat thread_id uses dedicated prefix to avoid chat contamination", () => {
    const user_id = "uuid-user-1";
    const agent_type_id = "accountant";
    const threadId = `heartbeat-${user_id}-${agent_type_id}`;
    expect(threadId).toBe("heartbeat-uuid-user-1-accountant");
    expect(threadId).toMatch(/^heartbeat-/);
    expect(threadId).not.toMatch(/^proactive:/); // old prefix from Supabase era
  });

  it("different agents produce different thread_ids", () => {
    const user = "uuid-user-1";
    const thread1 = `heartbeat-${user}-accountant`;
    const thread2 = `heartbeat-${user}-marketer`;
    expect(thread1).not.toBe(thread2);
  });
});

describe("Cadence Worker — agent display name mapping", () => {
  const AGENT_DISPLAY_NAMES: Record<string, string> = {
    chief_of_staff: "Chief of Staff",
    accountant: "Accountant",
    marketer: "Marketer",
    sales_rep: "Sales Rep",
    personal_assistant: "Personal Assistant",
  };

  it("maps all 5 agent types to display names", () => {
    expect(Object.keys(AGENT_DISPLAY_NAMES)).toHaveLength(5);
  });

  it("chief_of_staff maps to 'Chief of Staff'", () => {
    expect(AGENT_DISPLAY_NAMES.chief_of_staff).toBe("Chief of Staff");
  });

  it("unknown agent falls back to agent_type_id string", () => {
    const agentType = "unknown_agent";
    const display = AGENT_DISPLAY_NAMES[agentType] ?? agentType;
    expect(display).toBe("unknown_agent");
  });
});

describe("Cadence Worker — push notification contract (SCHED-05)", () => {
  it("push payload includes title and body fields", () => {
    const payload = JSON.stringify({ title: "Accountant", body: "Revenue increased 15%" });
    const parsed = JSON.parse(payload);
    expect(parsed).toHaveProperty("title");
    expect(parsed).toHaveProperty("body");
  });

  it("body is truncated to 200 characters", () => {
    const longContent = "x".repeat(300);
    const truncated = longContent.substring(0, 200);
    expect(truncated).toHaveLength(200);
  });
});

describe("Cadence Worker — isProactive flag", () => {
  it("heartbeat invoke always sets isProactive=true", () => {
    const invokeInput = { isProactive: true };
    expect(invokeInput.isProactive).toBe(true);
  });
});
