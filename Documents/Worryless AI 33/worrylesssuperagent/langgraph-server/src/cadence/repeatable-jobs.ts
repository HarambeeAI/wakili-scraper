/**
 * cadence/repeatable-jobs.ts — BullMQ repeatable jobs for daily briefing and morning digest
 *
 * Registers two repeatable jobs that replace the old pg_cron daily/morning schedules:
 *   - daily-briefing:  fires at 7am UTC — runs PA graph for all active PA users
 *   - morning-digest:  fires at 6am UTC — sends push notification digest of heartbeat_log activity
 *
 * Uses stable jobId to prevent duplicate registrations on server restart.
 * BullMQ deduplicates repeatable jobs by jobId — safe to call on every boot.
 *
 * Only called when NODE_ENV !== "test" (see src/index.ts startup guard).
 */

import { Queue, Worker, Job } from "bullmq";
import { getBullMQConnectionOptions } from "./redis.js";
import { getCheckpointer } from "../persistence/checkpointer.js";
import { createSupervisorGraph } from "../graph/supervisor.js";
import { getPool } from "../tools/shared/db.js";
import { sendPushNotification } from "./push-helper.js";

export const BRIEFING_QUEUE = "daily-briefing";
export const DIGEST_QUEUE = "morning-digest";

/**
 * Register BullMQ repeatable jobs for daily briefing and morning digest.
 * Uses stable jobId to prevent duplicate registrations on server restart.
 * Safe to call on every boot — BullMQ deduplicates by jobId.
 */
export async function registerRepeatableJobs(): Promise<void> {
  const briefingQueue = new Queue(BRIEFING_QUEUE, {
    connection: getBullMQConnectionOptions(),
  });
  const digestQueue = new Queue(DIGEST_QUEUE, {
    connection: getBullMQConnectionOptions(),
  });

  // Daily briefing at 7am UTC — replaces pg_cron '0 7 * * *'
  await briefingQueue.add(
    "daily-briefing",
    {},
    {
      repeat: { pattern: "0 7 * * *" },
      jobId: "daily-briefing-singleton",
    },
  );

  // Morning digest at 6am UTC — replaces pg_cron '0 6 * * *'
  await digestQueue.add(
    "morning-digest",
    {},
    {
      repeat: { pattern: "0 6 * * *" },
      jobId: "morning-digest-singleton",
    },
  );

  console.log(
    "[repeatable-jobs] Registered daily-briefing (7am UTC) and morning-digest (6am UTC)",
  );
}

/**
 * Process daily briefing: query all users with PA enabled, invoke PA graph with briefing prompt.
 */
async function processDailyBriefing(_job: Job): Promise<void> {
  const pool = getPool();
  const { rows: users } = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT ua.user_id FROM user_agents ua
     JOIN agent_types at ON ua.agent_type_id = at.id
     WHERE at.slug = 'personal_assistant' AND ua.is_active = true`,
  );

  for (const { user_id } of users) {
    try {
      const checkpointer = await getCheckpointer();
      const graph = createSupervisorGraph(checkpointer);
      await graph.invoke(
        {
          messages: [
            {
              role: "user",
              content:
                "Generate morning briefing for the user. Summarize key business metrics, upcoming tasks, and recent activity.",
            },
          ],
          userId: user_id,
          agentType: "personal_assistant",
          isProactive: true,
        },
        {
          configurable: { thread_id: `briefing-${user_id}-${Date.now()}` },
        },
      );
      console.log(`[daily-briefing] Completed for user=${user_id}`);
    } catch (err) {
      console.error(
        `[daily-briefing] Failed for user=${user_id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

/**
 * Process morning digest: collect heartbeat_log entries from last 24 hours and send summary push notification.
 */
async function processMorningDigest(_job: Job): Promise<void> {
  const pool = getPool();
  const { rows: digestRows } = await pool.query<{
    user_id: string;
    summary_count: string;
  }>(
    `SELECT user_id, COUNT(*) as summary_count
     FROM heartbeat_log
     WHERE created_at > NOW() - INTERVAL '24 hours'
     GROUP BY user_id
     HAVING COUNT(*) > 0`,
  );

  for (const { user_id, summary_count } of digestRows) {
    try {
      await sendPushNotification(
        user_id,
        "Morning Digest",
        `You have ${summary_count} agent update(s) from the last 24 hours. Open your dashboard to review.`,
      );
      console.log(
        `[morning-digest] Sent digest to user=${user_id} (${summary_count} updates)`,
      );
    } catch (err) {
      console.error(
        `[morning-digest] Failed for user=${user_id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

/**
 * Start BullMQ workers for repeatable job queues.
 * Workers run in the background — safe to call at server startup.
 */
export function startRepeatableWorker(): void {
  const briefingWorker = new Worker(
    BRIEFING_QUEUE,
    processDailyBriefing,
    {
      connection: getBullMQConnectionOptions(),
      concurrency: 1,
    },
  );

  const digestWorker = new Worker(DIGEST_QUEUE, processMorningDigest, {
    connection: getBullMQConnectionOptions(),
    concurrency: 1,
  });

  briefingWorker.on("failed", (job, err) => {
    console.error(`[daily-briefing] Job ${job?.id} failed:`, err.message);
  });

  digestWorker.on("failed", (job, err) => {
    console.error(`[morning-digest] Job ${job?.id} failed:`, err.message);
  });

  console.log(
    "[repeatable-jobs] Workers started for daily-briefing and morning-digest",
  );
}
