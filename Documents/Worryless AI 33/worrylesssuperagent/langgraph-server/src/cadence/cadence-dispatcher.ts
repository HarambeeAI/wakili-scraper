/**
 * cadence-dispatcher.ts — node-cron scheduler that enqueues due agents to BullMQ
 *
 * Fires every 5 minutes, queries get_due_cadence_agents() from Postgres,
 * and enqueues one BullMQ job per due agent.
 *
 * Replaces: pg_cron (every 5 minutes) + pgmq enqueue in Supabase heartbeat-runner.
 *
 * Only started when NODE_ENV !== "test" (see src/index.ts startup guard).
 */

import cron from "node-cron";
import { Queue } from "bullmq";
import { createRedisConnection } from "./redis.js";
import { getPool } from "../tools/shared/db.js";

export const QUEUE_NAME = "heartbeat";

let heartbeatQueue: Queue | null = null;

function getHeartbeatQueue(): Queue {
  if (heartbeatQueue) return heartbeatQueue;
  heartbeatQueue = new Queue(QUEUE_NAME, {
    connection: createRedisConnection(),
  });
  return heartbeatQueue;
}

export function startCadenceScheduler(): void {
  const queue = getHeartbeatQueue();

  // Fire every 5 minutes — replaces pg_cron every-5-minutes job
  cron.schedule("*/5 * * * *", async () => {
    try {
      const pool = getPool();
      const { rows } = await pool.query<{
        id: string;
        user_id: string;
        agent_type_id: string;
        heartbeat_interval_hours: number;
        cadence_tier: string;
      }>("SELECT * FROM get_due_cadence_agents()");

      for (const agent of rows) {
        await queue.add(
          "heartbeat",
          {
            user_id: agent.user_id,
            agent_type_id: agent.agent_type_id,
            cadence_tier: agent.cadence_tier,
          },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        );
      }

      console.log(`[cadence-dispatcher] Enqueued ${rows.length} agents`);
    } catch (err) {
      console.error(
        "[cadence-dispatcher] Tick failed:",
        err instanceof Error ? err.message : err,
      );
    }
  });

  console.log("[cadence-dispatcher] node-cron started (every 5 minutes)");
}
