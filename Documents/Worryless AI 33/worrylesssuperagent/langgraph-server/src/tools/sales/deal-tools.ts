// Deal management tools — SALES-07, SALES-08, SALES-12
// Handles deal status updates, follow-up scheduling, and stale deal detection.

import { getPool } from "../shared/db.js";
import type { DealStatusUpdate, FollowUp, StaleDeal } from "./types.js";

const VALID_STATUSES = [
  "prospecting",
  "contacted",
  "responded",
  "qualified",
  "proposal",
  "converted",
  "closed_won",
  "closed_lost",
  "lost",
] as const;

// Days without update before a deal is considered stale (terminal states never go stale)
const STALE_THRESHOLDS: Record<string, number> = {
  prospecting: 7,
  contacted: 5,
  responded: 5,
  qualified: 14,
  proposal: 10,
  converted: 999,
  closed_won: 999,
  closed_lost: 999,
  lost: 999,
};

/**
 * SALES-07: Update a deal's pipeline stage.
 * Validates status against the full extended ENUM before writing.
 */
export async function updateDealStatus(input: DealStatusUpdate): Promise<string> {
  if (!VALID_STATUSES.includes(input.newStatus as (typeof VALID_STATUSES)[number])) {
    throw new Error(
      `Invalid status: ${input.newStatus}. Valid: ${VALID_STATUSES.join(", ")}`,
    );
  }

  const pool = getPool();
  const result = await pool.query<{ company_name: string; contact_name: string }>(
    `UPDATE public.leads
     SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING company_name, contact_name`,
    [input.newStatus, input.notes ?? null, input.leadId, input.userId],
  );

  if (result.rows.length === 0) {
    return "Lead not found.";
  }

  const { company_name } = result.rows[0];
  return `${company_name} moved to ${input.newStatus}.`;
}

/**
 * SALES-08: Schedule a follow-up for a lead.
 * Updates lead.follow_up_scheduled_at and inserts an agent_tasks row
 * so the cadence engine picks it up at the scheduled time.
 */
export async function scheduleFollowUp(input: FollowUp): Promise<string> {
  const pool = getPool();

  // Update the lead with the scheduled follow-up timestamp
  const leadResult = await pool.query<{ company_name: string }>(
    `UPDATE public.leads
     SET follow_up_scheduled_at = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING company_name`,
    [input.scheduledAt, input.leadId, input.userId],
  );

  const company_name =
    leadResult.rows[0]?.company_name ?? "Unknown company";

  // Insert into agent_tasks for cadence engine pickup
  await pool.query(
    `INSERT INTO public.agent_tasks (user_id, agent_type, title, description, status, next_run_at)
     VALUES ($1, 'sales_rep', $2, $3, 'pending', $4)`,
    [
      input.userId,
      `Follow up: ${company_name}`,
      input.reason ?? "Scheduled follow-up",
      input.scheduledAt,
    ],
  );

  return `Follow-up scheduled for ${company_name} on ${input.scheduledAt}.`;
}

/**
 * SALES-12: Detect deals that have gone stale (no update beyond per-stage threshold).
 * Excludes terminal states. Filters in JS against STALE_THRESHOLDS after DB query.
 */
export async function detectStaleDeals(userId: string): Promise<StaleDeal[]> {
  const pool = getPool();

  const result = await pool.query<{
    id: string;
    company_name: string;
    contact_name: string;
    status: string;
    score: number;
    deal_value: number | null;
    updated_at: Date;
  }>(
    `SELECT id, company_name, contact_name, status, score, deal_value, updated_at
     FROM public.leads
     WHERE user_id = $1
       AND status NOT IN ('converted', 'closed_won', 'closed_lost', 'lost')
       AND updated_at < NOW() - INTERVAL '5 days'
     ORDER BY updated_at ASC
     LIMIT 20`,
    [userId],
  );

  const now = Date.now();
  const stale: StaleDeal[] = [];

  for (const row of result.rows) {
    const daysSinceUpdate = Math.floor(
      (now - new Date(row.updated_at).getTime()) / 86400000,
    );
    const threshold = STALE_THRESHOLDS[row.status] ?? 7;
    if (daysSinceUpdate >= threshold) {
      stale.push({
        id: row.id,
        company_name: row.company_name,
        contact_name: row.contact_name,
        status: row.status,
        score: row.score,
        deal_value: row.deal_value,
        updated_at: row.updated_at.toISOString(),
        daysSinceUpdate,
      });
    }
  }

  return stale;
}
