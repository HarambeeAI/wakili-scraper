// SALES-06: Email engagement tracking from outreach_emails table

import { getPool } from "../shared/db.js";
import type { EmailEngagement } from "./types.js";

export async function trackEmailEngagement(
  userId: string,
  leadId?: string,
): Promise<EmailEngagement[]> {
  const pool = getPool();

  // Build query — conditionally filter by leadId
  const params: (string | undefined)[] = [userId];
  const leadFilter = leadId ? "AND oe.lead_id = $2" : "";
  if (leadId) params.push(leadId);

  const queryText = `
    SELECT
      oe.id as email_id,
      oe.subject,
      oe.sent_at,
      oe.open_count as opens,
      oe.click_count as clicks,
      oe.replied_at IS NOT NULL as replied,
      l.contact_name as lead_name,
      l.company_name
    FROM public.outreach_emails oe
    JOIN public.leads l ON l.id = oe.lead_id
    WHERE oe.user_id = $1
    ${leadFilter}
    AND oe.sent_at IS NOT NULL
    ORDER BY oe.sent_at DESC
    LIMIT 50
  `;

  const result = await pool.query<{
    email_id: string;
    subject: string;
    sent_at: string;
    opens: number;
    clicks: number;
    replied: boolean;
    lead_name: string;
    company_name: string;
  }>(queryText, params);

  return result.rows.map((row) => ({
    emailId: row.email_id,
    subject: row.subject,
    sentAt: row.sent_at,
    opens: row.opens ?? 0,
    clicks: row.clicks ?? 0,
    replied: row.replied ?? false,
    leadName: row.lead_name,
    companyName: row.company_name,
  }));
}
