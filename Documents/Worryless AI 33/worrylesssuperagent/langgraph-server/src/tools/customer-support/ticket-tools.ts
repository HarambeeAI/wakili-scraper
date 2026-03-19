// OPS-01: Customer Support ticket CRUD + KB RAG search
// Queries public.support_tickets using shared DB pool.
// KB search uses ragRetrieveByText with "customer_support" namespace.

import { getPool } from "../shared/db.js";
import { ragRetrieveByText } from "../rag-retrieval.js";
import { callLLM } from "../../llm/client.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { CreateTicketInput, SupportTicketRow } from "./types.js";

/**
 * Create a new support ticket in public.support_tickets.
 */
export async function createTicket(
  input: CreateTicketInput,
): Promise<{ ticketId: string; message: string }> {
  const db = getPool();
  const result = await db.query<{ id: string }>(
    `INSERT INTO public.support_tickets
       (user_id, customer_name, customer_email, subject, description, priority, category)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.userId,
      input.customerName,
      input.customerEmail ?? null,
      input.subject,
      input.description ?? null,
      input.priority ?? "normal",
      input.category ?? null,
    ],
  );
  const ticketId = result.rows[0].id;
  return {
    ticketId,
    message: `Support ticket created: #${ticketId} -- "${input.subject}"`,
  };
}

/**
 * List support tickets for a user, optionally filtered by status.
 */
export async function listTickets(
  userId: string,
  status?: string,
): Promise<{ tickets: SupportTicketRow[]; count: number; message: string }> {
  const db = getPool();

  let rows: SupportTicketRow[];
  if (status) {
    const result = await db.query<SupportTicketRow>(
      `SELECT * FROM public.support_tickets
       WHERE user_id = $1 AND status = $2
       ORDER BY created_at DESC LIMIT 50`,
      [userId, status],
    );
    rows = result.rows;
  } else {
    const result = await db.query<SupportTicketRow>(
      `SELECT * FROM public.support_tickets
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [userId],
    );
    rows = result.rows;
  }

  return {
    tickets: rows,
    count: rows.length,
    message: rows.length === 0 ? "No support tickets found." : `${rows.length} ticket(s) found.`,
  };
}

/**
 * Update an existing ticket's status, resolution, or priority.
 * Automatically sets resolved_at when status is set to 'resolved'.
 */
export async function updateTicket(
  userId: string,
  ticketId: string,
  updates: { status?: string; resolution?: string; priority?: string },
): Promise<{ updated: boolean; message: string }> {
  const db = getPool();

  const isResolved = updates.status === "resolved";
  await db.query(
    `UPDATE public.support_tickets
     SET status = COALESCE($3, status),
         resolution = COALESCE($4, resolution),
         priority = COALESCE($5, priority),
         updated_at = now()
         ${isResolved ? ", resolved_at = now()" : ""}
     WHERE id = $2 AND user_id = $1`,
    [
      userId,
      ticketId,
      updates.status ?? null,
      updates.resolution ?? null,
      updates.priority ?? null,
    ],
  );

  return {
    updated: true,
    message: isResolved
      ? `Ticket #${ticketId} marked as resolved.`
      : `Ticket #${ticketId} updated.`,
  };
}

/**
 * Search the knowledge base via RAG and draft a grounded response using the LLM.
 */
export async function searchKBAndDraftResponse(
  userId: string,
  query: string,
): Promise<{
  kbResults: Array<{ source: string | null; content: string; similarity: number }>;
  draftResponse: string | null;
  message: string;
}> {
  const results = await ragRetrieveByText(userId, query, 5, "customer_support");

  if (results.length === 0) {
    return {
      kbResults: [],
      draftResponse: null,
      message:
        "No knowledge base articles found. Add business documentation to enable grounded responses.",
    };
  }

  const kbContext = results
    .map((r, i) => `[Article ${i + 1}] ${r.content}`)
    .join("\n\n");

  const { content } = await callLLM(
    [
      new HumanMessage(
        `Customer query: ${query}\n\nKnowledge base context:\n${kbContext}`,
      ),
    ],
    {
      systemPrompt:
        "You are a helpful customer support agent. Draft a professional, empathetic response to the customer query, grounded strictly in the provided knowledge base articles. Do not invent information not present in the articles.",
    },
  );

  return {
    kbResults: results.map((r) => ({
      source: r.source,
      content: r.content,
      similarity: r.similarity ?? 0,
    })),
    draftResponse: content,
    message: `Draft response based on ${results.length} knowledge base article(s).`,
  };
}
