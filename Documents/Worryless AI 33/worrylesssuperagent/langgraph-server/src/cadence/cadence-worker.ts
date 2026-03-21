/**
 * cadence-worker.ts — BullMQ worker that processes heartbeat jobs
 *
 * Dequeues jobs from the "heartbeat" BullMQ queue and:
 *   1. Calls graph.invoke() with isProactive=true and a dedicated heartbeat thread_id
 *   2. Logs the result to the heartbeat_log table
 *   3. Sends a push notification for non-empty heartbeat results via web-push
 *
 * thread_id uses `heartbeat-${user_id}-${agent_type_id}` prefix to avoid
 * contaminating the user's chat history.
 *
 * Only started when NODE_ENV !== "test" (see src/index.ts startup guard).
 */

import { Worker, Job } from "bullmq";
import { getBullMQConnectionOptions } from "./redis.js";
import { getCheckpointer } from "../persistence/checkpointer.js";
import { createSupervisorGraph } from "../graph/supervisor.js";
import { getHeartbeatPrompt } from "./heartbeat-prompts.js";
import { sendPushNotification } from "./push-helper.js";
import { getPool } from "../tools/shared/db.js";
import { QUEUE_NAME } from "./cadence-dispatcher.js";

interface HeartbeatJobData {
  user_id: string;
  agent_type_id: string;
  cadence_tier: string;
}

// Agent type display names for push notifications
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  chief_of_staff: "Chief of Staff",
  accountant: "Accountant",
  marketer: "Marketer",
  sales_rep: "Sales Rep",
  personal_assistant: "Personal Assistant",
};

export function startHeartbeatWorker(): Worker {
  const worker = new Worker<HeartbeatJobData>(
    QUEUE_NAME,
    async (job: Job<HeartbeatJobData>) => {
      const { user_id, agent_type_id, cadence_tier } = job.data;
      const prompt =
        getHeartbeatPrompt(agent_type_id, cadence_tier) ??
        `Heartbeat check. Cadence: ${cadence_tier}`;

      const checkpointer = await getCheckpointer();
      const graph = createSupervisorGraph(checkpointer);

      const result = await graph.invoke(
        {
          messages: [{ role: "user", content: prompt }],
          userId: user_id,
          agentType: agent_type_id,
          isProactive: true,
        },
        {
          configurable: {
            thread_id: `heartbeat-${user_id}-${agent_type_id}`,
          },
        },
      );

      // Extract last message content for push notification
      const lastMsg = result.messages?.[result.messages.length - 1];
      const content =
        typeof lastMsg?.content === "string" ? lastMsg.content : "";

      // Log heartbeat result to heartbeat_log table
      try {
        const pool = getPool();
        await pool.query(
          `INSERT INTO heartbeat_log (user_id, agent_type, cadence_tier, result_summary, severity)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            user_id,
            agent_type_id,
            cadence_tier,
            content.substring(0, 500),
            "info",
          ],
        );
      } catch (logErr) {
        console.warn(
          "[heartbeat-worker] Failed to log heartbeat (non-fatal):",
          logErr instanceof Error ? logErr.message : logErr,
        );
      }

      // Send push notification for non-empty heartbeat results
      if (content.length > 0) {
        const displayName = AGENT_DISPLAY_NAMES[agent_type_id] ?? agent_type_id;
        await sendPushNotification(
          user_id,
          displayName,
          content.substring(0, 200),
        );
      }

      console.log(
        `[heartbeat-worker] Completed user=${user_id} agent=${agent_type_id} tier=${cadence_tier}`,
      );
      return { success: true };
    },
    {
      connection: getBullMQConnectionOptions(),
      concurrency: 3,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[heartbeat-worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("ready", () => {
    console.log("[heartbeat-worker] BullMQ worker ready");
  });

  return worker;
}
