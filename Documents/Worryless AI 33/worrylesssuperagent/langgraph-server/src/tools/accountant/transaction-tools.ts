// ACCT-02: Transaction recording with LLM auto-categorization.
// Inserts into public.transactions; uses callLLMWithStructuredOutput if no category given.

import { HumanMessage } from "@langchain/core/messages";
import { callLLMWithStructuredOutput } from "../../llm/client.js";
import { getPool } from "../shared/db.js";
import type { RecordTransactionInput } from "./types.js";

const CATEGORIES = [
  "food",
  "transport",
  "office",
  "utilities",
  "marketing",
  "payroll",
  "rent",
  "software",
  "insurance",
  "professional_services",
  "travel",
  "entertainment",
  "equipment",
  "other",
] as const;

/**
 * Insert a financial transaction into public.transactions.
 * If no category is provided, auto-categorizes via LLM.
 * Returns the UUID of the inserted transaction.
 */
export async function recordTransaction(
  input: RecordTransactionInput,
): Promise<string> {
  let category = input.category ?? null;

  if (!category) {
    const { data } = await callLLMWithStructuredOutput<{ category: string }>(
      [
        new HumanMessage(
          `Categorize this financial transaction into ONE category (${CATEGORIES.join(", ")}): '${input.description}' amount: ${input.amount} type: ${input.type}`,
        ),
      ],
      '{"category": "string"}',
      { temperature: 0.1 },
    );
    category = data.category ?? "other";
  }

  const db = getPool();
  const result = await db.query<{ id: string }>(
    `INSERT INTO public.transactions (user_id, type, amount, category, description, date, invoice_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.userId,
      input.type,
      input.amount,
      category,
      input.description,
      input.date ?? new Date().toISOString().split("T")[0],
      input.invoiceId ?? null,
    ],
  );
  return result.rows[0].id;
}
