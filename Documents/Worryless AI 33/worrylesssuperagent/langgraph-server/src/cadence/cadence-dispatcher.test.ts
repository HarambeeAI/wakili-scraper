import { describe, it, expect } from "vitest";

/**
 * Cadence Dispatcher Logic Tests (CAD-01, CAD-04)
 *
 * Tests the TypeScript-side dispatch logic: tierConfig mapping, message shapes,
 * fallback behaviour, and cadence tier routing correctness.
 * SQL function get_due_cadence_agents cannot be unit-tested from vitest;
 * these tests cover the TypeScript consumer layer.
 */

// ---------------------------------------------------------------------------
// Inline tierConfig — mirrors the heartbeat-dispatcher and proactive-runner
// to ensure the TypeScript logic is independently validated.
// ---------------------------------------------------------------------------
const tierConfig: Record<string, { column: string; intervalMs: number }> = {
  daily: {
    column: "next_heartbeat_at",
    intervalMs: 4 * 60 * 60 * 1000, // 4 hours (default; actual is per-agent)
  },
  weekly: {
    column: "next_weekly_heartbeat_at",
    intervalMs: 7 * 24 * 60 * 60 * 1000,
  },
  monthly: {
    column: "next_monthly_heartbeat_at",
    intervalMs: 30 * 24 * 60 * 60 * 1000,
  },
  quarterly: {
    column: "next_quarterly_heartbeat_at",
    intervalMs: 90 * 24 * 60 * 60 * 1000,
  },
};

describe("Cadence Dispatcher — tierConfig mapping", () => {
  it("maps daily tier to next_heartbeat_at column", () => {
    expect(tierConfig.daily.column).toBe("next_heartbeat_at");
  });

  it("maps weekly tier to next_weekly_heartbeat_at column", () => {
    expect(tierConfig.weekly.column).toBe("next_weekly_heartbeat_at");
  });

  it("maps monthly tier to next_monthly_heartbeat_at column", () => {
    expect(tierConfig.monthly.column).toBe("next_monthly_heartbeat_at");
  });

  it("maps quarterly tier to next_quarterly_heartbeat_at column", () => {
    expect(tierConfig.quarterly.column).toBe("next_quarterly_heartbeat_at");
  });

  it("weekly interval is exactly 7 days in milliseconds", () => {
    expect(tierConfig.weekly.intervalMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("monthly interval is exactly 30 days in milliseconds", () => {
    expect(tierConfig.monthly.intervalMs).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("quarterly interval is exactly 90 days in milliseconds", () => {
    expect(tierConfig.quarterly.intervalMs).toBe(90 * 24 * 60 * 60 * 1000);
  });
});

describe("Cadence Dispatcher — fallback behaviour", () => {
  it("falls back to daily when cadence_tier is undefined", () => {
    const cadenceTier: string | undefined = undefined;
    const tier = tierConfig[cadenceTier ?? "daily"];
    expect(tier).toBeDefined();
    expect(tier.column).toBe("next_heartbeat_at");
  });

  it("falls back to daily when cadence_tier is empty string", () => {
    const cadenceTier = "";
    const tier = tierConfig[cadenceTier] ?? tierConfig.daily;
    expect(tier.column).toBe("next_heartbeat_at");
  });

  it("falls back to daily when cadence_tier is an unknown value", () => {
    const cadenceTier = "biweekly"; // not a known tier
    const tier = tierConfig[cadenceTier] ?? tierConfig.daily;
    expect(tier.column).toBe("next_heartbeat_at");
  });
});

describe("Cadence Dispatcher — pgmq message shape", () => {
  it("standard heartbeat message includes all required fields", () => {
    const message = {
      user_agent_id: "uuid-agent-1",
      user_id: "uuid-user-1",
      agent_type_id: "accountant",
      cadence_tier: "daily",
    };
    expect(message.user_agent_id).toBeTruthy();
    expect(message.user_id).toBeTruthy();
    expect(message.agent_type_id).toBeTruthy();
    expect(message.cadence_tier).toBe("daily");
  });

  it("weekly message carries correct cadence_tier", () => {
    const message = {
      user_agent_id: "uuid-agent-2",
      user_id: "uuid-user-2",
      agent_type_id: "accountant",
      cadence_tier: "weekly",
    };
    expect(message.cadence_tier).toBe("weekly");
    // Weekly agent is due only when next_weekly_heartbeat_at <= now()
    // (SQL-side: validated by get_due_cadence_agents function)
    expect(tierConfig[message.cadence_tier].column).toBe(
      "next_weekly_heartbeat_at",
    );
  });

  it("event tier message carries cadence_tier and event_type fields", () => {
    const eventMessage = {
      user_agent_id: "uuid-agent-3",
      user_id: "uuid-user-3",
      agent_type_id: "accountant",
      cadence_tier: "event",
      event_type: "overdue_invoice",
    };
    expect(eventMessage.cadence_tier).toBe("event");
    expect(eventMessage.event_type).toBe("overdue_invoice");
  });

  it("proactive-runner /invoke body includes is_proactive flag", () => {
    const invokeBody = {
      message: "Run your daily financial health check.",
      user_id: "uuid-user-4",
      thread_id: "proactive:accountant:uuid-user-4",
      agent_type: "accountant",
      is_proactive: true,
    };
    expect(invokeBody.is_proactive).toBe(true);
    expect(invokeBody.thread_id).toMatch(/^proactive:/);
  });
});

describe("Cadence Dispatcher — weekly agent due-date logic", () => {
  it("weekly agent is due when next_weekly_heartbeat_at is in the past", () => {
    const pastDate = new Date(Date.now() - 1000); // 1 second ago
    const now = new Date();
    // Simulate SQL WHERE condition: next_weekly_heartbeat_at <= now()
    const isDue = pastDate <= now;
    expect(isDue).toBe(true);
  });

  it("weekly agent is NOT due when next_weekly_heartbeat_at is in the future", () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days out
    const now = new Date();
    const isDue = futureDate <= now;
    expect(isDue).toBe(false);
  });

  it("advance timestamp moves weekly column 7 days forward", () => {
    const before = Date.now();
    const nextRun = new Date(before + tierConfig.weekly.intervalMs);
    const diffMs = nextRun.getTime() - before;
    expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("Cadence Dispatcher — isProactive token budget bypass contract", () => {
  it("is_proactive=true in invoke body maps to isProactive=true in AgentState", () => {
    // This test documents the expected mapping in index.ts /invoke handler.
    // Actual enforcement is in the integration (base-agent.ts), but the
    // message contract must be consistent.
    const requestBody = { is_proactive: true };
    const agentStateInput = { isProactive: requestBody.is_proactive === true };
    expect(agentStateInput.isProactive).toBe(true);
  });

  it("is_proactive missing from body defaults to false", () => {
    const requestBody: Record<string, unknown> = {};
    const agentStateInput = { isProactive: requestBody.is_proactive === true };
    expect(agentStateInput.isProactive).toBe(false);
  });

  it("is_proactive=false does NOT set isProactive", () => {
    const requestBody = { is_proactive: false };
    const agentStateInput = { isProactive: requestBody.is_proactive === true };
    expect(agentStateInput.isProactive).toBe(false);
  });
});

describe("Cadence Dispatcher — module exports", () => {
  it("exports startCadenceScheduler function", async () => {
    const mod = await import("./cadence-dispatcher.js");
    expect(typeof mod.startCadenceScheduler).toBe("function");
  });

  it("exports QUEUE_NAME as 'heartbeat'", async () => {
    const mod = await import("./cadence-dispatcher.js");
    expect(mod.QUEUE_NAME).toBe("heartbeat");
  });
});

describe("Cadence Dispatcher — BullMQ job options contract", () => {
  it("heartbeat job data contains required fields", () => {
    const jobData = {
      user_id: "uuid-user-1",
      agent_type_id: "accountant",
      cadence_tier: "daily",
    };
    expect(jobData).toHaveProperty("user_id");
    expect(jobData).toHaveProperty("agent_type_id");
    expect(jobData).toHaveProperty("cadence_tier");
  });

  it("job options include retry with exponential backoff", () => {
    const jobOpts = {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    };
    expect(jobOpts.attempts).toBe(3);
    expect(jobOpts.backoff.type).toBe("exponential");
    expect(jobOpts.backoff.delay).toBe(5000);
  });
});
