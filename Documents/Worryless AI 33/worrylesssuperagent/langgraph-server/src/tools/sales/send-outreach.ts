// SALES-05: Outreach sending with HITL approval gate + Resend delivery + DB recording

import { getPool } from "../shared/db.js";
import type { OutreachEmail } from "./types.js";
import { interruptForApproval } from "../../hitl/interrupt-handler.js";

// CRITICAL: interruptForApproval calls interrupt() which is a LangGraph signal.
// This function MUST be called from within a graph node context.
export async function sendOutreach(
  userId: string,
  outreach: OutreachEmail,
  recipientEmail: string,
): Promise<string> {
  // HITL is mandatory — pause graph for human approval before sending
  const decision = interruptForApproval({
    action: "send_outreach",
    agentType: "sales_rep",
    description: `Send outreach email to ${outreach.contactName} at ${outreach.companyName}`,
    payload: {
      leadId: outreach.leadId,
      subject: outreach.subject,
      body: outreach.body,
      recipientEmail,
    },
  });

  if (!decision.approved) {
    return "Outreach cancelled by user.";
  }

  // Check Resend API key
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured — add your Resend API key in Settings.");
  }

  // Send via Resend
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Worryless AI Team <myteam@worryless.ai>",
      to: [recipientEmail],
      subject: outreach.subject,
      html: outreach.body,
    }),
  });

  const result = (await response.json()) as { id?: string; message?: string };
  if (!response.ok) {
    throw new Error(result.message ?? "Resend send failed");
  }

  const pool = getPool();

  // Record in outreach_emails table
  await pool.query(
    `INSERT INTO public.outreach_emails (user_id, lead_id, subject, body, sent_at, resend_email_id)
     VALUES ($1, $2, $3, $4, NOW(), $5)`,
    [userId, outreach.leadId, outreach.subject, outreach.body, result.id ?? null],
  );

  // Update lead status to 'contacted' (only if still in prospecting stage)
  await pool.query(
    `UPDATE public.leads SET status = 'contacted', updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'prospecting'`,
    [outreach.leadId, userId],
  );

  return `Outreach email sent to ${outreach.contactName} at ${outreach.companyName}.`;
}
