import pg from "pg";

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

/**
 * Atomically checkout a task, preventing double-work across concurrent agent instances.
 *
 * Uses PostgreSQL's atomic UPDATE ... WHERE claimed_by IS NULL RETURNING id pattern.
 * This is safe under READ COMMITTED isolation (Supabase default) — the UPDATE is
 * atomic, so only one concurrent caller can succeed. No advisory locks needed.
 *
 * @param taskId  - UUID of the agent_task to claim
 * @param claimedBy - Identifier of the claimer (e.g., agent_type_id or 'heartbeat-runner')
 * @returns true if checkout succeeded (this caller owns the task), false if already claimed
 */
export async function atomicCheckoutTask(
  taskId: string,
  claimedBy: string
): Promise<boolean> {
  const db = getPool();
  const result = await db.query<{ id: string }>(
    `UPDATE public.agent_tasks
     SET claimed_by = $2, claimed_at = NOW(), status = 'running'
     WHERE id = $1
       AND claimed_by IS NULL
       AND status IN ('pending', 'scheduled')
     RETURNING id`,
    [taskId, claimedBy]
  );
  return result.rowCount === 1;
}

/**
 * Release a task after completion or failure, clearing the checkout lock.
 *
 * Sets claimed_by = NULL and claimed_at = NULL so the task is no longer locked.
 * Sets status to 'completed' or 'failed' and records last_run_at.
 *
 * @param taskId    - UUID of the agent_task to release
 * @param newStatus - Final status: 'completed' on success, 'failed' on error
 */
export async function releaseTask(
  taskId: string,
  newStatus: "completed" | "failed"
): Promise<void> {
  const db = getPool();
  await db.query(
    `UPDATE public.agent_tasks
     SET claimed_by = NULL,
         claimed_at = NULL,
         status = $2,
         last_run_at = NOW()
     WHERE id = $1`,
    [taskId, newStatus]
  );
}
