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

export interface BudgetStatus {
  /** true when tokens_used >= budget AND no active override — agent should halt */
  paused: boolean;
  /** true when tokens_used >= 80% of budget — agent should surface a warning */
  warned: boolean;
  /** percentage of budget consumed (0-100+; can exceed 100 if override in use) */
  usedPct: number;
  /** tokens remaining (can be negative when over budget) */
  remaining: number;
}

/**
 * Check whether an agent has remaining token budget for this month.
 *
 * Auto-resets the budget if budget_reset_at has passed (lazy monthly reset).
 * This avoids needing a pg_cron job for resets — every check is authoritative.
 *
 * Usage: always check budget BEFORE calling the LLM to prevent runaway spending.
 */
export async function checkTokenBudget(
  userId: string,
  agentTypeId: string
): Promise<BudgetStatus> {
  const db = getPool();

  const { rows } = await db.query<{
    monthly_token_budget: number;
    tokens_used_this_month: number;
    budget_reset_at: string;
    budget_override_until: string | null;
  }>(
    `SELECT monthly_token_budget, tokens_used_this_month, budget_reset_at, budget_override_until
     FROM public.user_agents
     WHERE user_id = $1 AND agent_type_id = $2`,
    [userId, agentTypeId]
  );

  // No row found — agent not yet configured; return unlimited status
  if (!rows[0]) {
    return { paused: false, warned: false, usedPct: 0, remaining: 100000 };
  }

  const row = rows[0];

  // Lazy monthly reset: if we are past the reset date, reset and return fresh status
  if (new Date(row.budget_reset_at) < new Date()) {
    await resetMonthlyBudget(userId, agentTypeId);
    return { paused: false, warned: false, usedPct: 0, remaining: row.monthly_token_budget };
  }

  const budget = row.monthly_token_budget;
  const used = row.tokens_used_this_month;
  const pct = budget > 0 ? (used / budget) * 100 : 0;
  const hasOverride =
    row.budget_override_until != null &&
    new Date(row.budget_override_until) > new Date();

  return {
    paused: pct >= 100 && !hasOverride,
    warned: pct >= 80,
    usedPct: pct,
    remaining: budget - used,
  };
}

/**
 * Increment the token usage counter for an agent after an LLM call.
 *
 * Call this AFTER every LLM invocation using the tokensUsed from LLMResponse.
 */
export async function incrementTokenUsage(
  userId: string,
  agentTypeId: string,
  tokens: number
): Promise<void> {
  const db = getPool();
  await db.query(
    `UPDATE public.user_agents
     SET tokens_used_this_month = tokens_used_this_month + $3
     WHERE user_id = $1 AND agent_type_id = $2`,
    [userId, agentTypeId, tokens]
  );
}

/**
 * Reset the monthly token usage counter and set the next reset date.
 *
 * Called automatically by checkTokenBudget when budget_reset_at has passed.
 * Can also be called manually for admin overrides.
 */
export async function resetMonthlyBudget(
  userId: string,
  agentTypeId: string
): Promise<void> {
  const db = getPool();
  await db.query(
    `UPDATE public.user_agents
     SET tokens_used_this_month = 0,
         budget_reset_at = date_trunc('month', NOW() + INTERVAL '1 month')
     WHERE user_id = $1 AND agent_type_id = $2`,
    [userId, agentTypeId]
  );
}
