import pg from "pg";
import type { GoalChainEntry } from "../types/agent-state.js";

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

export interface AuditLogEntry {
  userId: string;
  agentTypeId: string;
  action: "llm_response" | "tool_call" | "delegation" | "briefing" | "task_checkout";
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  toolCalls?: Array<{ name: string; input: unknown; output: unknown }>;
  tokensUsed: number;
  goalChain?: GoalChainEntry[] | null;
  threadId?: string | null;
}

/**
 * Write an immutable audit log entry to public.agent_audit_log.
 *
 * IMPORTANT: This function is intentionally fire-and-forget. Callers MUST use:
 *   writeAuditLog(entry).catch(console.error);
 * and NEVER:
 *   await writeAuditLog(entry);  // Do NOT await — adds 50-200ms latency on every invocation
 *
 * The audit log is eventually consistent by design. Losing an occasional entry
 * on crash is acceptable; blocking the agent response path is not.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO public.agent_audit_log
       (user_id, agent_type_id, action, input, output, tool_calls, tokens_used, goal_chain, thread_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.userId,
      entry.agentTypeId,
      entry.action,
      JSON.stringify(entry.input),
      JSON.stringify(entry.output),
      JSON.stringify(entry.toolCalls ?? []),
      entry.tokensUsed,
      entry.goalChain != null ? JSON.stringify(entry.goalChain) : null,
      entry.threadId ?? null,
    ]
  );
}
