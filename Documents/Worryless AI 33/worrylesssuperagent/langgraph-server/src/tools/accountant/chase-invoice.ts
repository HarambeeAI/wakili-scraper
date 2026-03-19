// chase-invoice.ts — Invoice chase with HITL approval + Resend email (ACCT-10)
//
// CRITICAL: interruptForApproval calls LangGraph interrupt() which throws a special
// signal. This function MUST ONLY be called from within a graph node context.
// The accountantTools node provides that context.

import { HumanMessage } from "@langchain/core/messages";
import { getPool } from "../shared/db.js";
import { callLLM } from "../../llm/client.js";
import { interruptForApproval } from "../../hitl/interrupt-handler.js";

interface InvoiceQueryRow {
  id: string;
  vendor_name: string;
  vendor_email: string | null;
  amount: number;
  currency: string;
  due_date: string | null;
  status: string;
  description: string | null;
}

// ACCT-10: Chase an overdue invoice — reads vendor_email from DB, drafts email,
// pauses for HITL approval, then sends via Resend to vendor_email.
export async function chaseOverdueInvoice(
  userId: string,
  invoiceId: string,
): Promise<string> {
  const db = getPool();
  const result = await db.query<InvoiceQueryRow>(
    `SELECT id, vendor_name, vendor_email, amount, currency, due_date, status, description
     FROM public.invoices
     WHERE id = $1 AND user_id = $2`,
    [invoiceId, userId],
  );

  if (result.rows.length === 0) {
    return "Invoice not found.";
  }

  const invoice = result.rows[0];
  const { id, vendor_name, vendor_email, amount, currency, due_date, status } = invoice;

  if (status !== "overdue") {
    return `Invoice is not overdue (status: ${status}).`;
  }

  // CRITICAL: vendor_email resolution — return clear error if NULL or empty
  if (!vendor_email || vendor_email.trim() === "") {
    return `Cannot send payment reminder: no vendor email address on file for invoice ${invoiceId} (${vendor_name}). Please update the invoice with the vendor's email address first.`;
  }

  // Calculate days overdue
  const dueDate = due_date ? new Date(due_date) : null;
  const daysOverdue = dueDate
    ? Math.floor((Date.now() - dueDate.getTime()) / 86400000)
    : 0;

  // Draft reminder email via LLM
  const draftResult = await callLLM(
    [
      new HumanMessage(
        `Draft a payment reminder email for:
Vendor: ${vendor_name}
Amount due: ${currency} ${amount}
Days overdue: ${daysOverdue}
Invoice ID: ${id}

Keep the email firm but polite, professional, and under 200 words.`,
      ),
    ],
    {
      systemPrompt:
        "You are a professional accounts receivable specialist. Draft a firm but polite payment reminder email. Keep under 200 words.",
    },
  );

  // HITL: Pause for user approval before sending email
  const decision = interruptForApproval({
    action: "chase_overdue_invoice",
    agentType: "accountant",
    description: `Send payment reminder to ${vendor_name} (${vendor_email}) for ${currency} ${amount} (${daysOverdue} days overdue)`,
    payload: {
      invoiceId: id,
      emailDraft: draftResult.content,
      vendorName: vendor_name,
      vendorEmail: vendor_email,
      amount,
      daysOverdue,
    },
  });

  if (!decision.approved) {
    return "Invoice chase cancelled by user.";
  }

  // Send email via Resend
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY not configured — add your Resend API key in Settings.",
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Worryless AI Team <myteam@worryless.ai>",
      to: [vendor_email],
      subject: `Payment Reminder: Invoice ${invoiceId}`,
      html: draftResult.content,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send email via Resend (${response.status}): ${errorText}`);
  }

  return `Payment reminder sent to ${vendor_name} at ${vendor_email}.`;
}
