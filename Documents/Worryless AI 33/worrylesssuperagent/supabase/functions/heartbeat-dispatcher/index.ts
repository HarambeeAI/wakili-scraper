import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

// SEC-02: Request body is entirely ignored.
// User identity is derived exclusively from user_agents DB rows.
// Dispatcher uses service-role key — no JWT, no user session.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Tier column + interval mapping — mirrors proactive-runner's advance logic.
// The dispatcher advances the correct next_*_heartbeat_at column immediately
// after enqueuing to prevent duplicate enqueueing on the next cron tick.
const tierConfig: Record<string, { column: string; intervalMs: number }> = {
  daily: {
    column: "next_heartbeat_at",
    intervalMs: 0, // intervalMs is dynamic for daily (uses agent.heartbeat_interval_hours)
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

Deno.serve(async (_req) => {
  // _req is intentionally unused (underscore prefix).
  // The request body is never read — all identity comes from the DB (SEC-02).
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Find agents due for a heartbeat — supports multi-tier cadence.
  // Try the new get_due_cadence_agents function first; fall back to the original
  // get_due_heartbeat_agents if the migration has not been applied yet.
  // Business-hours and budget checks live entirely in SQL (DST-safe, always accurate).
  // deno-lint-ignore no-explicit-any
  let dueAgents: any[] = [];
  let queryError = null;

  const cadenceResult = await supabaseAdmin.rpc("get_due_cadence_agents");
  if (
    cadenceResult.error &&
    cadenceResult.error.message.includes("does not exist")
  ) {
    // Fallback: old dispatcher function — wrap rows with cadence_tier="daily"
    const fallback = await supabaseAdmin.rpc("get_due_heartbeat_agents");
    // deno-lint-ignore no-explicit-any
    dueAgents = (fallback.data ?? []).map((a: any) => ({
      ...a,
      cadence_tier: "daily",
    }));
    queryError = fallback.error;
    console.log(
      "[heartbeat-dispatcher] Fell back to get_due_heartbeat_agents (migration not applied)",
    );
  } else {
    dueAgents = cadenceResult.data ?? [];
    queryError = cadenceResult.error;
  }

  if (queryError) {
    console.error("Dispatcher query failed:", queryError);
    return new Response(JSON.stringify({ error: queryError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let enqueued = 0;
  let dailyCount = 0;
  let weeklyCount = 0;
  let monthlyCount = 0;
  let quarterlyCount = 0;

  for (const agent of dueAgents) {
    const cadenceTier: string = agent.cadence_tier ?? "daily";

    // Enqueue into pgmq heartbeat_jobs queue.
    // userId comes from the DB row (agent.user_id) — never from the request body (SEC-02).
    // cadence_tier is included so proactive-runner and heartbeat-runner can select
    // the correct tier prompt and advance the correct timestamp column.
    const { error: sendError } = await supabaseAdmin
      .schema("pgmq_public")
      .rpc("send", {
        queue_name: "heartbeat_jobs",
        message: {
          user_agent_id: agent.id,
          user_id: agent.user_id, // sourced from user_agents row — not request (SEC-02)
          agent_type_id: agent.agent_type_id,
          cadence_tier: cadenceTier, // NEW: multi-tier routing field
        },
        sleep_seconds: 0,
      });

    if (sendError) {
      console.error(
        `Failed to enqueue agent ${agent.id} (tier=${cadenceTier}):`,
        sendError,
      );
      continue;
    }

    // Advance the correct next-run column ONLY for successfully enqueued agents.
    // Budget-skipped agents retain their existing timestamp (Pitfall 6 prevention).
    // Note: budget-skipped agents never reach this path — excluded by the SQL function.
    const tier = tierConfig[cadenceTier] ?? tierConfig.daily;

    // Daily interval is dynamic (per-agent heartbeat_interval_hours)
    const intervalMs = cadenceTier === "daily"
      ? (agent.heartbeat_interval_hours ?? 4) * 60 * 60 * 1000
      : tier.intervalMs;

    await supabaseAdmin
      .from("user_agents")
      .update({
        [tier.column]: new Date(Date.now() + intervalMs).toISOString(),
      })
      .eq("id", agent.id);

    enqueued++;

    // Count per tier for logging
    switch (cadenceTier) {
      case "daily":
        dailyCount++;
        break;
      case "weekly":
        weeklyCount++;
        break;
      case "monthly":
        monthlyCount++;
        break;
      case "quarterly":
        quarterlyCount++;
        break;
    }
  }

  console.log(
    `Dispatcher: enqueued=${enqueued} (daily=${dailyCount}, weekly=${weeklyCount}, monthly=${monthlyCount}, quarterly=${quarterlyCount})`,
  );

  return new Response(
    JSON.stringify({ enqueued, dailyCount, weeklyCount, monthlyCount, quarterlyCount }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
