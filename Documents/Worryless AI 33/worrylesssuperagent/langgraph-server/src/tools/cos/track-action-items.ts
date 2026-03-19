/**
 * track-action-items.ts — COS-06
 *
 * Queries public.agent_tasks for all active tasks owned by this user,
 * returning them with goal_chain context for the Chief of Staff to track.
 *
 * IMPORTANT: Table is `public.agent_tasks` (not `public.tasks`).
 */

import pg from "pg";
import type { GoalChainEntry } from "../../types/agent-state.js";

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

export interface ActionItem {
  id: string;
  title: string;
  agentType: string;
  status: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  goalChain: GoalChainEntry[] | null;
}

interface ActionItemRow {
  id: string;
  title: string;
  agent_type: string;
  status: string;
  next_run_at: string | null;
  last_run_at: string | null;
  goal_chain: GoalChainEntry[] | null;
}

/**
 * Returns all active agent_tasks for a user, ordered by urgency.
 * Active statuses: pending, scheduled, running, needs_approval.
 * Includes goal_chain for goal ancestry context.
 */
export async function trackActionItems(userId: string): Promise<ActionItem[]> {
  const db = getPool();

  const result = await db.query<ActionItemRow>(
    `SELECT id, title, agent_type, status, next_run_at, last_run_at, goal_chain
     FROM public.agent_tasks
     WHERE user_id = $1
       AND status IN ('pending', 'scheduled', 'running', 'needs_approval')
     ORDER BY
       CASE status
         WHEN 'needs_approval' THEN 0
         WHEN 'running' THEN 1
         WHEN 'pending' THEN 2
         WHEN 'scheduled' THEN 3
       END,
       next_run_at ASC NULLS LAST
     LIMIT 50`,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    agentType: row.agent_type,
    status: row.status,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    goalChain: row.goal_chain,
  }));
}
