import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * Compute the next 8am occurrence in the user's timezone (returns UTC ISO string).
 * Always schedules for tomorrow 8am to avoid re-sending on the same hour run.
 */
function nextDigestRunAt(timezone: string): string {
  const now = new Date();
  // Get current time in user's timezone
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  // Tomorrow at 8am in user's timezone
  const tomorrow = new Date(tzNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  // Convert back to UTC: find offset
  const utcOffset = now.getTime() - tzNow.getTime();
  return new Date(tomorrow.getTime() + utcOffset).toISOString();
}

serve(async (_req) => {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all users whose digest is due now
    const { data: dueUsers, error: usersError } = await (supabaseAdmin
      .from("profiles")
      .select("id, timezone")
      .lte("next_digest_run_at", new Date().toISOString())
      .eq("onboarding_completed", true) as any);

    if (usersError) {
      console.error("[send-morning-digest] Profile query failed:", usersError);
      return new Response(JSON.stringify({ error: usersError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!dueUsers || dueUsers.length === 0) {
      console.log(
        "[send-morning-digest] No users due for digest — nothing to send",
      );
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let sent = 0;

    type ProfileRow = { id: string; timezone: string | null };

    const LANGGRAPH_SERVER_URL = Deno.env.get("LANGGRAPH_SERVER_URL");

    for (const user of dueUsers as ProfileRow[]) {
      const userId = user.id;
      const timezone = user.timezone ?? "UTC";

      // Fetch full profile including use_langgraph for CoS thread delivery
      const { data: profile } = await (supabaseAdmin
        .from("profiles")
        .select("email, use_langgraph")
        .eq("id", userId)
        .single() as any);

      // Query digest-severity rows for this user in the past 24h
      const { data: digestRows, error: digestError } = await supabaseAdmin
        .from("agent_heartbeat_log")
        .select("user_id, agent_type_id, summary, run_at")
        .eq("severity", "digest")
        .eq("user_id", userId)
        .gte("run_at", since)
        .order("run_at", { ascending: true });

      if (digestError) {
        console.error(
          `[send-morning-digest] Digest query failed for user ${userId}:`,
          digestError,
        );
      } else if (digestRows && digestRows.length > 0) {
        // Build consolidated markdown briefing
        type DigestRow = {
          user_id: string;
          agent_type_id: string;
          summary: string;
          run_at: string;
        };
        const bulletPoints = (digestRows as DigestRow[])
          .map((r) => `- **${r.agent_type_id}**: ${r.summary}`)
          .join("\n");
        const digestText = bulletPoints;
        const briefingContent = `## Morning Briefing\n\nHere are the items your agents flagged for your review:\n\n${digestText}\n\nAll of these were low-priority findings from the past 24 hours. Let me know if you'd like to act on any of them.`;

        // Insert as Chief of Staff notification (in-app delivery mechanism)
        // The notifications table is the correct Chief of Staff channel for the heartbeat system.
        // send-daily-briefing uses email (Resend) — that is a separate, pre-existing feature.
        const { error: notifError } = await supabaseAdmin
          .from("notifications")
          .insert({
            user_id: userId,
            agent_type_id: "chief_of_staff",
            severity: "digest",
            message: briefingContent,
            link_type: "agent_panel",
          });

        if (notifError) {
          console.error(
            `[send-morning-digest] Failed to insert notification for user ${userId}:`,
            notifError,
          );
        } else {
          sent++;
        }

        // Step 4b: Write morning briefing to CoS LangGraph thread (for use_langgraph users)
        if (LANGGRAPH_SERVER_URL && profile?.use_langgraph) {
          try {
            const briefingPrompt = `Compile the morning briefing from these overnight agent findings:\n\n${digestText}\n\nOrganize by urgency, provide action recommendations, and correlate any cross-agent findings.`;
            const cosThreadId = `proactive:chief_of_staff:${userId}`;

            await fetch(`${LANGGRAPH_SERVER_URL}/invoke`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: briefingPrompt,
                user_id: userId,
                thread_id: cosThreadId,
                agent_type: "chief_of_staff",
              }),
            });
            // Fire-and-forget — morning digest notification is the critical path, not the CoS thread
          } catch (cosErr) {
            console.error(
              `[send-morning-digest] CoS thread write failed for user ${userId} (non-fatal):`,
              cosErr,
            );
          }
        }
      } else {
        console.log(
          `[send-morning-digest] No digest findings for user ${userId} — skipping notification`,
        );
      }

      // Always update next_digest_run_at regardless of whether a notification was sent
      const nextRun = nextDigestRunAt(timezone);
      const { error: updateError } = await (supabaseAdmin
        .from("profiles")
        .update({ next_digest_run_at: nextRun })
        .eq("id", userId) as any);

      if (updateError) {
        console.error(
          `[send-morning-digest] Failed to update next_digest_run_at for user ${userId}:`,
          updateError,
        );
      }
    }

    console.log(
      `[send-morning-digest] Morning digest: sent briefings to ${sent} of ${dueUsers.length} due users`,
    );
    return new Response(JSON.stringify({ sent, due: dueUsers.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-morning-digest] Fatal error:", err);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
