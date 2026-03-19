// OPS-02: Legal contract CRUD + AI-powered review + template drafting
// Queries public.contracts using shared DB pool.

import { getPool } from "../shared/db.js";
import { callLLM, callLLMWithStructuredOutput } from "../../llm/client.js";
import { HumanMessage } from "@langchain/core/messages";
import type { ContractReview, ContractRow } from "./types.js";

/**
 * Insert a new contract record into public.contracts.
 */
export async function createContract(
  userId: string,
  title: string,
  counterparty: string,
  contractType?: string,
  value?: number,
  startDate?: string,
  endDate?: string,
  renewalDate?: string,
): Promise<{ contractId: string; message: string }> {
  const db = getPool();
  const result = await db.query<{ id: string }>(
    `INSERT INTO public.contracts
       (user_id, title, counterparty, contract_type, value, start_date, end_date, renewal_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      userId,
      title,
      counterparty,
      contractType ?? "general",
      value ?? null,
      startDate ?? null,
      endDate ?? null,
      renewalDate ?? null,
    ],
  );
  const contractId = result.rows[0].id;
  return {
    contractId,
    message: `Contract created: "${title}" with ${counterparty}`,
  };
}

/**
 * List contracts for a user, optionally filtered by status.
 */
export async function listContracts(
  userId: string,
  status?: string,
): Promise<{ contracts: ContractRow[]; count: number; message: string }> {
  const db = getPool();

  let rows: ContractRow[];
  if (status) {
    const result = await db.query<ContractRow>(
      `SELECT * FROM public.contracts
       WHERE user_id = $1 AND status = $2
       ORDER BY created_at DESC`,
      [userId, status],
    );
    rows = result.rows;
  } else {
    const result = await db.query<ContractRow>(
      `SELECT * FROM public.contracts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    rows = result.rows;
  }

  return {
    contracts: rows,
    count: rows.length,
    message: rows.length === 0 ? "No contracts on file." : `${rows.length} contract(s) found.`,
  };
}

/**
 * Review a contract's text using the LLM to extract risk flags and key terms.
 * Persists the review results back to the contracts table.
 */
export async function reviewContract(
  userId: string,
  contractId: string,
  contractText: string,
): Promise<ContractReview> {
  const schema =
    '{ "riskFlags": [{ "severity": "high|medium|low", "description": "string", "clause": "string" }], "keyTerms": { "parties": "string", "payment": "string", "termination": "string", "ip": "string", "liability": "string" }, "recommendation": "string" }';

  const { data } = await callLLMWithStructuredOutput<{
    riskFlags: Array<{ severity: "high" | "medium" | "low"; description: string; clause: string }>;
    keyTerms: Record<string, string>;
    recommendation: string;
  }>(
    [new HumanMessage(contractText)],
    schema,
    {
      systemPrompt:
        "Review this contract for legal risks. Identify risk flags by severity, extract key terms, and provide a recommendation. Caveat: This is not legal advice.",
    },
  );

  const db = getPool();
  await db.query(
    `UPDATE public.contracts
     SET risk_flags = $3, key_terms = $4, updated_at = now()
     WHERE id = $2 AND user_id = $1`,
    [
      userId,
      contractId,
      JSON.stringify(data.riskFlags),
      JSON.stringify(data.keyTerms),
    ],
  );

  const riskCount = data.riskFlags.length;
  const reviewMessage =
    riskCount === 0
      ? "Contract review complete. No risk flags identified."
      : `Contract review complete. ${riskCount} risk flag(s) identified.`;

  return {
    contractId,
    riskFlags: data.riskFlags,
    keyTerms: data.keyTerms,
    recommendation: data.recommendation + " " + reviewMessage,
  };
}

/**
 * Draft a contract template (NDA, MSA, SOW, etc.) using the LLM.
 */
export async function draftTemplate(
  userId: string,
  templateType: string,
  parties?: string,
): Promise<{ template: string; message: string }> {
  const partiesClause = parties ? ` between ${parties}` : "";
  const prompt = `Draft a professional ${templateType} contract template${partiesClause}. Include all standard clauses. Mark variable fields with [PLACEHOLDER] notation.`;

  const { content } = await callLLM(
    [new HumanMessage(prompt)],
    {
      systemPrompt:
        "You are a professional contract drafter. Produce complete, well-structured contract templates with clearly marked placeholders for variable information. Caveat: This is not legal advice.",
    },
  );

  const title = `${templateType} Template`;
  return {
    template: content,
    message: `Contract template drafted: "${title}"`,
  };
}
