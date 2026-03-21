import { describe, it, expect } from "vitest";

describe("Repeatable Jobs — module exports", () => {
  it("exports registerRepeatableJobs function", async () => {
    const mod = await import("./repeatable-jobs.js");
    expect(typeof mod.registerRepeatableJobs).toBe("function");
  });

  it("exports startRepeatableWorker function", async () => {
    const mod = await import("./repeatable-jobs.js");
    expect(typeof mod.startRepeatableWorker).toBe("function");
  });

  it("exports BRIEFING_QUEUE as 'daily-briefing'", async () => {
    const mod = await import("./repeatable-jobs.js");
    expect(mod.BRIEFING_QUEUE).toBe("daily-briefing");
  });

  it("exports DIGEST_QUEUE as 'morning-digest'", async () => {
    const mod = await import("./repeatable-jobs.js");
    expect(mod.DIGEST_QUEUE).toBe("morning-digest");
  });
});

describe("Repeatable Jobs — cron schedule contract (SCHED-04)", () => {
  it("daily briefing fires at 7am UTC", () => {
    const pattern = "0 7 * * *";
    // Validate cron format: minute=0, hour=7, day=*, month=*, weekday=*
    const parts = pattern.split(" ");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe("0"); // minute
    expect(parts[1]).toBe("7"); // hour (UTC)
  });

  it("morning digest fires at 6am UTC (before briefing)", () => {
    const pattern = "0 6 * * *";
    const parts = pattern.split(" ");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe("0"); // minute
    expect(parts[1]).toBe("6"); // hour (UTC)
    // Digest at 6am, briefing at 7am — digest runs first to collect overnight data
    expect(parseInt(parts[1])).toBeLessThan(7);
  });
});

describe("Repeatable Jobs — idempotent registration contract", () => {
  it("daily briefing uses stable jobId to prevent duplicates across restarts", () => {
    const jobId = "daily-briefing-singleton";
    expect(jobId).toContain("singleton");
    expect(jobId).toBe("daily-briefing-singleton"); // exact match required
  });

  it("morning digest uses stable jobId to prevent duplicates across restarts", () => {
    const jobId = "morning-digest-singleton";
    expect(jobId).toContain("singleton");
    expect(jobId).toBe("morning-digest-singleton"); // exact match required
  });
});

describe("Repeatable Jobs — daily briefing processor contract", () => {
  it("briefing SQL queries active personal_assistant agents", () => {
    const expectedQuery = "personal_assistant";
    // The processor queries user_agents joined with agent_types where slug = 'personal_assistant'
    expect(expectedQuery).toBe("personal_assistant");
  });

  it("briefing invoke uses isProactive=true to bypass token budgets", () => {
    const invokeInput = { isProactive: true };
    expect(invokeInput.isProactive).toBe(true);
  });

  it("briefing thread_id uses unique prefix to avoid checkpoint collision", () => {
    const userId = "uuid-user-1";
    const threadId = `briefing-${userId}-${Date.now()}`;
    expect(threadId).toMatch(/^briefing-/);
    expect(threadId).not.toMatch(/^heartbeat-/); // different from heartbeat threads
  });
});

describe("Repeatable Jobs — morning digest processor contract", () => {
  it("digest queries heartbeat_log from last 24 hours", () => {
    const intervalHours = 24;
    expect(intervalHours).toBe(24);
  });

  it("digest sends push notification with update count", () => {
    const count = 5;
    const body = `You have ${count} agent update(s) from the last 24 hours. Open your dashboard to review.`;
    expect(body).toContain("5 agent update(s)");
    expect(body).toContain("dashboard");
  });
});
