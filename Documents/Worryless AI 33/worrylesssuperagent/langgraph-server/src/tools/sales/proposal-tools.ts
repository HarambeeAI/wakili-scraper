// Proposal generation tool — SALES-09
// Generates a structured B2B sales proposal via LLM and stores it in agent_assets.

import { HumanMessage } from "@langchain/core/messages";
import { getPool } from "../shared/db.js";
import { callLLM } from "../../llm/client.js";
import type { ProposalInput } from "./types.js";

const PROPOSAL_SYSTEM_PROMPT = `You are a professional B2B sales proposal writer. Create a structured sales proposal with these sections:
1. Executive Summary
2. Understanding Your Needs (from prospect research)
3. Proposed Solution
4. Pricing & Terms
5. Timeline
6. Next Steps

Use HTML formatting.`;

/**
 * SALES-09: Generate a sales proposal via LLM and store it in agent_assets.
 * Returns the asset UUID that the caller can reference or share.
 */
export async function createProposal(input: ProposalInput): Promise<string> {
  const pool = getPool();

  // Fetch existing lead data for context (research notes, history)
  const leadResult = await pool.query<{
    company_name: string;
    contact_name: string;
    notes: string | null;
    score: number;
    deal_value: number | null;
  }>(
    `SELECT company_name, contact_name, notes, score, deal_value
     FROM public.leads
     WHERE id = $1 AND user_id = $2`,
    [input.leadId, input.userId],
  );

  const lead = leadResult.rows[0];
  const researchNotes = lead?.notes ?? "No prior research available.";

  // Build the proposal prompt
  const promptContent = `Create a sales proposal for the following prospect:

Company: ${input.companyName}
Contact: ${input.contactName}
Solution Summary: ${input.solutionSummary}${input.pricing ? `\nProposed Pricing: ${input.pricing}` : ""}

Prospect Research & Notes:
${researchNotes}`;

  const llmResult = await callLLM([new HumanMessage(promptContent)], {
    systemPrompt: PROPOSAL_SYSTEM_PROMPT,
    temperature: 0.7,
    maxTokens: 2048,
  });

  const proposalHtml = llmResult.content;

  // Store proposal in agent_assets
  const assetResult = await pool.query<{ id: string }>(
    `INSERT INTO public.agent_assets (user_id, agent_type, asset_type, title, content, related_lead_id, metadata)
     VALUES ($1, 'sales_rep', 'document', $2, $3, $4, $5)
     RETURNING id`,
    [
      input.userId,
      `Proposal for ${input.companyName}`,
      proposalHtml,
      input.leadId,
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        contactName: input.contactName,
      }),
    ],
  );

  return assetResult.rows[0].id;
}
