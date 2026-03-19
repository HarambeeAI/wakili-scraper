import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { extractJson, parseSeverity } from "../_shared/heartbeatParser.ts";

// SEC-02: Request body is entirely ignored.
// User identity is derived exclusively from the heartbeat_jobs queue message.
// Dispatcher uses service-role key — no JWT, no user session.

// ---------------------------------------------------------------------------
// Heartbeat prompts — duplicated from langgraph-server for Deno compatibility
// Deno Edge Functions cannot import Node.js modules.
// CAD-01: Tier-specific prompts trigger the correct agent graph classification.
// NOTE: Prompts MUST NOT instruct agents to "chase", "send reminder", or "publish" —
// proactive runs are observation-only; actions require HITL approval.
// ---------------------------------------------------------------------------
const HEARTBEAT_PROMPTS: Record<string, Record<string, string>> = {
  accountant: {
    daily:
      "Run your daily financial health check. Review recent transactions, outstanding invoices, and cash balance. Report any anomalies, overdue invoices (without chasing), or budget concerns that need the owner's attention.",
    weekly:
      "Run your weekly financial review. Analyse cash flow trends, unpaid invoices aged 7+ days, and expense patterns from this week. Identify any P&L concerns or cash runway risks.",
    monthly:
      "Run your monthly financial audit. Review the full month's P&L, cash flow statement, tax obligations due, and VAT/GST if applicable. Flag any material variances versus prior month.",
    quarterly:
      "Run your quarterly financial assessment. Review the quarter's revenue trajectory, cost structure, runway forecast, and any upcoming tax deadlines or compliance obligations.",
  },
  marketer: {
    daily:
      "Run your daily marketing pulse check. Review recent post engagement, brand mention alerts, and content calendar status. Flag any content gaps or engagement anomalies.",
    weekly:
      "Run your weekly marketing review. Analyse this week's content performance, audience growth, campaign results, and any brand mentions requiring attention.",
    monthly:
      "Run your monthly marketing audit. Review the full month's content performance, channel ROI, audience growth, and brand sentiment. Identify strategic gaps or opportunities.",
    quarterly:
      "Run your quarterly marketing assessment. Review channel mix effectiveness, quarterly content output, brand reach, and competitive positioning changes.",
  },
  sales_rep: {
    daily:
      "Run your daily pipeline check. Review deals in progress, meetings scheduled today, and any leads requiring follow-up. Flag stalled deals or missed responses (without sending outreach).",
    weekly:
      "Run your weekly sales review. Analyse pipeline progression, deals won/lost this week, lead quality, and conversion rates. Flag any pipeline health concerns.",
    monthly:
      "Run your monthly sales audit. Review the full month's quota attainment, pipeline coverage, deal velocity, and lead generation volume. Identify trends or risks.",
    quarterly:
      "Run your quarterly sales assessment. Review quarterly revenue vs. target, win/loss analysis, pipeline composition, and forecast accuracy. Flag strategic pipeline concerns.",
  },
  chief_of_staff: {
    daily:
      "Run your daily executive briefing. Review all agent findings from the past 24 hours, pending decisions, and urgent tasks. Synthesise the three most important things the owner needs to know today.",
    weekly:
      "Run your weekly business health review. Consolidate cross-agent insights: financial health, marketing performance, sales pipeline, and operations. Identify the top three priorities for next week.",
    monthly:
      "Run your monthly executive review. Synthesise all agent monthly reports into a holistic business health summary. Identify strategic opportunities, risks, and recommended focus areas.",
    quarterly:
      "Run your quarterly strategic review. Consolidate quarterly performance across all departments. Assess goal achievement, identify gaps, and recommend strategic pivots or investments.",
  },
  personal_assistant: {
    daily:
      "Run your daily schedule and inbox check. Review today's calendar events, unread important emails, and any pending tasks. Flag scheduling conflicts or time-sensitive items.",
    weekly:
      "Run your weekly administrative review. Check upcoming appointments, recurring commitments, travel bookings, and outstanding correspondence that needs attention.",
    monthly:
      "Run your monthly administrative audit. Review recurring obligations, subscription renewals, important dates, and any administrative tasks that have been deferred.",
    quarterly:
      "Run your quarterly administrative assessment. Review quarterly commitments, travel patterns, key relationship touchpoints, and any long-range scheduling needs.",
  },
  operations_manager: {
    daily:
      "Run your daily operations check. Review active projects, team workload, blockers, and customer support queue status. Flag any operational bottlenecks or escalations.",
    weekly:
      "Run your weekly operations review. Analyse project delivery status, team capacity, process bottlenecks, and customer satisfaction signals from this week.",
    monthly:
      "Run your monthly operations audit. Review project completion rates, team performance trends, process improvements made, and operational KPIs versus targets.",
    quarterly:
      "Run your quarterly operations assessment. Review capacity planning, process maturity, vendor performance, and operational efficiency improvements.",
  },
};

const DEFAULT_PROMPT =
  "Run your scheduled heartbeat check. Review your area of responsibility and report any findings that require the owner's attention. Do not take actions — observation only.";

function getHeartbeatPrompt(agentTypeId: string, cadenceTier: string): string {
  const agentPrompts = HEARTBEAT_PROMPTS[agentTypeId];
  if (!agentPrompts) return DEFAULT_PROMPT;
  return agentPrompts[cadenceTier] ?? agentPrompts["daily"] ?? DEFAULT_PROMPT;
}

// ---------------------------------------------------------------------------
// Event-specific prompts — duplicated from langgraph-server/src/cadence/event-detector.ts
// for Deno compatibility. Prompts must match the Node.js module exactly.
// CAD-07: Event-triggered proactive actions with targeted prompts.
// ---------------------------------------------------------------------------
const EVENT_PROMPTS: Record<string, { agentType: string; prompt: string }> = {
  overdue_invoice: {
    agentType: "accountant",
    prompt:
      "URGENT EVENT: Invoices with outstanding balances past due date detected. List all invoices that are past due, check cashflow impact of delayed payments, and flag severity by amount and days overdue. Surface findings for review.",
  },
  stale_deal: {
    agentType: "sales_rep",
    prompt:
      "URGENT EVENT: Stale deals detected — leads with no activity in 3+ days. Detect stale deals stuck in the pipeline, track email engagement and open rates on recent outreach for those leads, and provide re-engagement recommendations. Surface findings for review.",
  },
  expiring_contract: {
    agentType: "legal_advisor",
    prompt:
      "URGENT EVENT: Contracts expiring within 7 days detected. Review the contract calendar for upcoming expirations and renewal deadlines. Flag contracts requiring immediate attention and surface findings for review.",
  },
};

// ---------------------------------------------------------------------------
// Timestamp advance helpers — advance the correct next-run column per tier.
// The proactive-runner advances weekly/monthly/quarterly after processing.
// Daily advancement is handled by heartbeat-dispatcher (existing behaviour).
// ---------------------------------------------------------------------------
const ADVANCE_COLUMN: Record<string, string> = {
  daily: "next_heartbeat_at",
  weekly: "next_weekly_heartbeat_at",
  monthly: "next_monthly_heartbeat_at",
  quarterly: "next_quarterly_heartbeat_at",
};

const ADVANCE_INTERVAL_MS: Record<string, number> = {
  daily: 4 * 60 * 60 * 1000, // fallback — dispatcher normally handles daily
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  quarterly: 90 * 24 * 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Core processor — one pgmq message at a time
// ---------------------------------------------------------------------------
async function processProactiveHeartbeat(
  // deno-lint-ignore no-explicit-any
  message: Record<string, any>,
  supabaseAdmin: ReturnType<typeof createClient>,
  langgraphServerUrl: string,
): Promise<void> {
  const {
    user_id: userId,
    agent_type_id: agentTypeId,
    user_agent_id: userAgentId,
    cadence_tier: cadenceTier = "daily", // backward compat: old dispatcher messages lack cadence_tier
  } = message;

  if (!userId || !agentTypeId) {
    throw new Error(
      `[proactive-runner] Message missing user_id or agent_type_id: ${JSON.stringify(message)}`,
    );
  }

  // --- Feature flag gate ---
  // Only execute LangGraph for users with use_langgraph=true.
  // Non-LangGraph users: do NOT delete the message — let visibility timeout expire
  // so the old heartbeat-runner picks it up.
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("use_langgraph")
    .eq("user_id", userId)
    .single();

  if (!profile?.use_langgraph) {
    console.log(
      `[proactive-runner] Skipping non-LangGraph user ${userId} — message left for heartbeat-runner`,
    );
    // Signal to caller that this message should NOT be deleted (non-LangGraph user)
    return;
  }

  // --- Build heartbeat prompt ---
  // For event-type messages, use the targeted event prompt instead of the cadence tier prompt.
  const eventType = message.event_type as string | undefined;
  let heartbeatPrompt: string;
  if (cadenceTier === "event" && eventType && EVENT_PROMPTS[eventType]) {
    heartbeatPrompt = EVENT_PROMPTS[eventType].prompt;
  } else if (cadenceTier === "event") {
    // Unknown event type — generic fallback
    heartbeatPrompt =
      "An event was triggered for your attention. Review your recent activity and surface any actionable findings.";
  } else {
    heartbeatPrompt = getHeartbeatPrompt(agentTypeId, cadenceTier);
  }

  // --- Deterministic thread ID — persistent across proactive runs ---
  const threadId = `proactive:${agentTypeId}:${userId}`;

  // --- Call LangGraph /invoke ---
  console.log(
    `[proactive-runner] Invoking LangGraph for user=${userId} agent=${agentTypeId} tier=${cadenceTier}`,
  );

  const invokeResponse = await fetch(`${langgraphServerUrl}/invoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: heartbeatPrompt,
      user_id: userId,
      thread_id: threadId,
      agent_type: agentTypeId,
      is_proactive: true, // CAD-01/Pitfall 7: skip token budget increment in createLLMNode
    }),
  });

  if (!invokeResponse.ok) {
    const errText = await invokeResponse.text().catch(() => "");
    throw new Error(
      `[proactive-runner] LangGraph invoke failed: ${invokeResponse.status} ${errText}`,
    );
  }

  const invokeData = (await invokeResponse.json()) as {
    response: string;
    thread_id: string;
  };
  const rawResponse: string = invokeData.response ?? "";

  // --- Parse severity from LangGraph response ---
  // LangGraph agents are instructed to return JSON with severity/finding.
  // extractJson + parseSeverity provide fail-safe parsing (default to "ok" on failure).
  const cleanedJson = extractJson(rawResponse);
  const { severity, finding } = parseSeverity(cleanedJson);

  // --- HEARTBEAT_OK suppression — no DB writes for non-findings ---
  if (severity === "ok") {
    console.log(
      `[proactive-runner] severity=ok for user=${userId} agent=${agentTypeId} tier=${cadenceTier} — suppressed`,
    );
    // Advance tier timestamp even on "ok" runs so next run is scheduled correctly
    await advanceTierTimestamp(
      supabaseAdmin,
      userAgentId,
      userId,
      agentTypeId,
      cadenceTier,
    );
    return;
  }

  // --- Write to agent_heartbeat_log ---
  const { error: logError } = await supabaseAdmin
    .from("agent_heartbeat_log")
    .insert({
      user_id: userId,
      agent_type_id: agentTypeId,
      run_at: new Date().toISOString(),
      outcome: "surfaced",
      summary: finding,
      severity: severity,
      notification_sent: severity === "urgent" || severity === "headsup",
      task_created: false,
    });

  if (logError) {
    throw new Error(
      `[proactive-runner] Failed to insert heartbeat log: ${logError.message}`,
    );
  }

  // --- Write to notifications (urgent + headsup only) ---
  if (severity === "urgent" || severity === "headsup") {
    const { error: notifError } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: userId,
        agent_type_id: agentTypeId,
        severity,
        message: finding,
        link_type: "agent_panel",
      });

    if (notifError) {
      throw new Error(
        `[proactive-runner] Failed to insert notification: ${notifError.message}`,
      );
    }
  }

  // --- Advance next-run timestamp for this tier ---
  await advanceTierTimestamp(
    supabaseAdmin,
    userAgentId,
    userId,
    agentTypeId,
    cadenceTier,
  );

  console.log(
    `[proactive-runner] Processed user=${userId} agent=${agentTypeId} tier=${cadenceTier} severity=${severity}`,
  );
}

// ---------------------------------------------------------------------------
// Advance the correct next_*_heartbeat_at column after processing.
// Called after both "ok" (suppressed) and non-ok runs to keep scheduling correct.
// ---------------------------------------------------------------------------
async function advanceTierTimestamp(
  supabaseAdmin: ReturnType<typeof createClient>,
  userAgentId: string | undefined,
  userId: string,
  agentTypeId: string,
  cadenceTier: string,
): Promise<void> {
  const column = ADVANCE_COLUMN[cadenceTier];
  const intervalMs = ADVANCE_INTERVAL_MS[cadenceTier];

  if (!column || !intervalMs) {
    console.warn(
      `[proactive-runner] Unknown cadence tier "${cadenceTier}" — skipping timestamp advance`,
    );
    return;
  }

  // Only advance non-daily tiers — dispatcher handles daily advancement
  if (cadenceTier === "daily") return;

  // Look up user_agent_id if not in message (older messages may lack it)
  let agentId = userAgentId;
  if (!agentId) {
    const { data: ua } = await supabaseAdmin
      .from("user_agents")
      .select("id")
      .eq("user_id", userId)
      .eq("agent_type_id", agentTypeId)
      .single();
    agentId = ua?.id;
  }

  if (!agentId) {
    console.warn(
      `[proactive-runner] Could not find user_agent row for user=${userId} agent=${agentTypeId} — skipping timestamp advance`,
    );
    return;
  }

  await supabaseAdmin
    .from("user_agents")
    .update({
      [column]: new Date(Date.now() + intervalMs).toISOString(),
    })
    .eq("id", agentId);
}

// ---------------------------------------------------------------------------
// Deno.serve handler
// ---------------------------------------------------------------------------
Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Fail early if LangGraph server URL is not configured
    const LANGGRAPH_SERVER_URL = Deno.env.get("LANGGRAPH_SERVER_URL");
    if (!LANGGRAPH_SERVER_URL) {
      throw new Error(
        "[proactive-runner] LANGGRAPH_SERVER_URL environment variable is not configured",
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Dequeue up to 5 messages with 30s visibility timeout (prevents double-processing)
    const { data: messages, error: dequeueError } = await supabaseAdmin
      .schema("pgmq_public")
      .rpc("read", { queue_name: "heartbeat_jobs", sleep_seconds: 30, n: 5 });

    if (dequeueError) {
      console.error(
        "[proactive-runner] Failed to dequeue messages:",
        dequeueError,
      );
      return new Response(JSON.stringify({ error: dequeueError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const msgs = (messages ?? []) as Array<{
      msg_id: number;
      message: Record<string, unknown>;
    }>;
    let processed = 0;
    let skipped = 0;

    for (const msg of msgs) {
      try {
        // Track whether this message should be deleted.
        // Non-LangGraph users: do NOT delete (heartbeat-runner will re-process after timeout).
        let deleteMessage = true;

        // processProactiveHeartbeat returns void; non-LangGraph users
        // are handled by early return with log. We use a flag to detect this.
        const msgPayload = msg.message as Record<string, unknown>;
        const userId = msgPayload.user_id as string;

        // Re-check feature flag here to decide deletion (processProactiveHeartbeat also checks,
        // but we need the result here in the outer scope)
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("use_langgraph")
          .eq("user_id", userId)
          .single();

        if (!profile?.use_langgraph) {
          // Do NOT delete — let old heartbeat-runner pick up after visibility timeout
          console.log(
            `[proactive-runner] Skipping non-LangGraph user ${userId}`,
          );
          skipped++;
          deleteMessage = false;
        } else {
          await processProactiveHeartbeat(
            msgPayload,
            supabaseAdmin,
            LANGGRAPH_SERVER_URL,
          );
        }

        if (deleteMessage) {
          // Delete only after successful processing
          await supabaseAdmin.schema("pgmq_public").rpc("delete", {
            queue_name: "heartbeat_jobs",
            msg_id: msg.msg_id,
          });

          processed++;
        }
      } catch (processingErr) {
        // Do NOT delete — message becomes re-visible after visibility timeout
        console.error(
          `[proactive-runner] Processing failed for msg_id=${msg.msg_id}:`,
          processingErr,
        );
      }
    }

    console.log(`[proactive-runner] processed=${processed} skipped=${skipped}`);
    return new Response(JSON.stringify({ processed, skipped }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[proactive-runner] Fatal error:", err);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
