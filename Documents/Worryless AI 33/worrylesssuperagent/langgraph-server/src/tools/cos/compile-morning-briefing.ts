/**
 * compile-morning-briefing.ts — COS-01
 *
 * Aggregates agent heartbeat findings + overdue agent_tasks into a structured
 * morning briefing for the Chief of Staff. Calendar section is a placeholder —
 * Phase 15: PA Google Calendar integration will populate this.
 *
 * IMPORTANT: Table is `public.agent_tasks` (not `public.tasks`).
 * IMPORTANT: heartbeat_outcome enum has only ('surfaced', 'error') — no 'ok' value.
 *   Suppressed ok runs are never written to agent_heartbeat_log.
 *   Therefore we do NOT filter `outcome != 'ok'` — all rows are already non-ok.
 */

import pg from "pg";
import { AGENT_DISPLAY_NAMES } from "../../types/agent-types.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  pool = new Pool({ connectionString, max: 10 });
  return pool;
}

export interface BriefingItem {
  source: "heartbeat" | "task" | "calendar";
  agentTypeId?: string;
  agentDisplayName?: string;
  summary: string;
  urgency: "high" | "medium" | "low";
  actionable: boolean;
  metadata: Record<string, unknown>;
}

export interface BriefingSection {
  urgent: BriefingItem[];
  priorities: BriefingItem[];
  fyi: BriefingItem[];
  // Phase 15: PA Google Calendar integration will populate this
  calendar: BriefingItem[];
  generatedAt: string; // ISO timestamp
}

interface HeartbeatRow {
  agent_type_id: string;
  run_at: string;
  outcome: string;
  summary: string;
  task_created: boolean;
}

interface TaskRow {
  id: string;
  title: string;
  agent_type: string;
  status: string;
  next_run_at: string | null;
  task_config: Record<string, unknown> | null;
}

/**
 * Compiles a morning briefing from heartbeat findings and overdue tasks.
 * Returns a BriefingSection with urgent/priorities/fyi arrays and an empty
 * calendar placeholder for Phase 15.
 */
export async function compileMorningBriefing(userId: string): Promise<BriefingSection> {
  const db = getPool();

  // 1. Query agent_heartbeat_log for last 24 hours.
  //    heartbeat_outcome enum only has 'surfaced' and 'error' — no 'ok'.
  //    All rows are non-ok outcomes (ok runs are suppressed and not written).
  const heartbeatResult = await db.query<HeartbeatRow>(
    `SELECT agent_type_id, run_at, outcome, summary, task_created
     FROM public.agent_heartbeat_log
     WHERE user_id = $1
       AND run_at >= NOW() - INTERVAL '24 hours'
     ORDER BY run_at DESC
     LIMIT 20`,
    [userId]
  );

  // 2. Query agent_tasks for overdue and due-soon tasks
  const taskResult = await db.query<TaskRow>(
    `SELECT id, title, agent_type, status, next_run_at, task_config
     FROM public.agent_tasks
     WHERE user_id = $1
       AND status IN ('pending', 'scheduled')
       AND (next_run_at IS NULL OR next_run_at <= NOW() + INTERVAL '2 hours')
     ORDER BY next_run_at ASC NULLS FIRST
     LIMIT 15`,
    [userId]
  );

  const now = new Date();
  const urgent: BriefingItem[] = [];
  const priorities: BriefingItem[] = [];
  const fyi: BriefingItem[] = [];

  // Process heartbeat rows
  for (const row of heartbeatResult.rows) {
    const displayName =
      AGENT_DISPLAY_NAMES[row.agent_type_id as keyof typeof AGENT_DISPLAY_NAMES] ??
      row.agent_type_id;

    const item: BriefingItem = {
      source: "heartbeat",
      agentTypeId: row.agent_type_id,
      agentDisplayName: displayName,
      summary: row.summary,
      urgency: row.outcome === "error" ? "high" : "medium",
      actionable: row.task_created,
      metadata: {
        runAt: row.run_at,
        outcome: row.outcome,
        taskCreated: row.task_created,
      },
    };

    if (row.outcome === "error") {
      urgent.push(item);
    } else {
      // outcome === 'surfaced'
      priorities.push(item);
    }
  }

  // Process task rows
  for (const row of taskResult.rows) {
    const displayName =
      AGENT_DISPLAY_NAMES[row.agent_type as keyof typeof AGENT_DISPLAY_NAMES] ??
      row.agent_type;

    const isPastDue =
      row.next_run_at !== null && new Date(row.next_run_at) < now;
    const isDueSoon =
      row.next_run_at !== null &&
      !isPastDue &&
      new Date(row.next_run_at) <= new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const hasNoSchedule = row.next_run_at === null;

    const item: BriefingItem = {
      source: "task",
      agentTypeId: row.agent_type,
      agentDisplayName: displayName,
      summary: row.title,
      urgency: isPastDue ? "high" : isDueSoon ? "medium" : "low",
      actionable: true,
      metadata: {
        taskId: row.id,
        status: row.status,
        nextRunAt: row.next_run_at,
        taskConfig: row.task_config,
      },
    };

    if (isPastDue) {
      urgent.push(item);
    } else if (isDueSoon || hasNoSchedule) {
      priorities.push(item);
    } else {
      fyi.push(item);
    }
  }

  return {
    urgent,
    priorities,
    fyi,
    // Phase 15: PA Google Calendar integration will populate this
    calendar: [],
    generatedAt: now.toISOString(),
  };
}
