// OPS-02: Legal compliance — contract renewal calendar + regulatory monitoring
// contractCalendar queries public.contracts for upcoming renewals.
// monitorRegulatory is an LLM-only tool (no external API).

import { getPool } from "../shared/db.js";
import { callLLM } from "../../llm/client.js";
import { HumanMessage } from "@langchain/core/messages";
import type { RenewalAlert } from "./types.js";

/**
 * Return contracts with renewals due within the next N days (default 60).
 */
export async function contractCalendar(
  userId: string,
  daysAhead: number = 60,
): Promise<{ renewals: RenewalAlert[]; message: string }> {
  const db = getPool();
  const result = await db.query<{
    id: string;
    title: string;
    counterparty: string;
    renewal_date: string;
    value: number | null;
  }>(
    `SELECT id, title, counterparty, renewal_date, value
     FROM public.contracts
     WHERE user_id = $1
       AND renewal_date IS NOT NULL
       AND renewal_date <= NOW() + ($2 || ' days')::INTERVAL
     ORDER BY renewal_date ASC`,
    [userId, daysAhead],
  );

  if (result.rows.length === 0) {
    return {
      renewals: [],
      message: `No contract renewals due in the next ${daysAhead} days.`,
    };
  }

  const renewals: RenewalAlert[] = result.rows.map((row) => {
    const renewalDate = new Date(row.renewal_date);
    const now = new Date();
    const daysUntilRenewal = Math.ceil(
      (renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return {
      contractId: row.id,
      title: row.title,
      counterparty: row.counterparty,
      renewalDate: row.renewal_date,
      daysUntilRenewal,
      value: row.value,
    };
  });

  return {
    renewals,
    message: `${renewals.length} contract(s) due for renewal within ${daysAhead} days.`,
  };
}

/**
 * Monitor relevant regulatory updates for the user's industry using the LLM.
 * This is an LLM-only tool — no external regulatory API required.
 */
export async function monitorRegulatory(
  userId: string,
  industry?: string,
): Promise<{
  updates: Array<{ topic: string; summary: string; relevance: string }>;
  message: string;
}> {
  const industryContext = industry
    ? `The user operates in the ${industry} industry.`
    : "The user's industry is unspecified — provide broadly applicable regulatory topics.";

  const prompt = `${industryContext}

List 3-5 current regulatory topics that are relevant. For each, provide:
- topic: the regulatory area or legislation name
- summary: a 1-2 sentence summary of the requirement or change
- relevance: why this matters to a small-to-medium business

Return a JSON array with objects having keys: topic, summary, relevance.`;

  const { content } = await callLLM([new HumanMessage(prompt)], {
    systemPrompt:
      "You are a legal compliance assistant. Provide factual, actionable regulatory updates. Always note that this is not legal advice and the user should consult a qualified attorney.",
  });

  // Parse JSON from LLM response, stripping markdown fences if present
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let updates: Array<{ topic: string; summary: string; relevance: string }> = [];
  try {
    const parsed = JSON.parse(jsonStr);
    updates = Array.isArray(parsed) ? parsed : parsed.updates ?? [];
  } catch {
    // LLM didn't return valid JSON — wrap raw content
    updates = [
      {
        topic: "Regulatory Summary",
        summary: content,
        relevance: "Consult a qualified attorney for industry-specific advice.",
      },
    ];
  }

  return {
    updates,
    message: `${updates.length} regulatory topic(s) identified${industry ? ` for ${industry}` : ""}.`,
  };
}
