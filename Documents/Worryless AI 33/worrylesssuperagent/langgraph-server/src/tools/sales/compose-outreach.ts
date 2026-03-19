// SALES-04: Personalized outreach composition via LLM with prospect research context

import { getPool } from "../shared/db.js";
import type { LeadRow, OutreachEmail } from "./types.js";
import { callLLMWithStructuredOutput } from "../../llm/client.js";
import { HumanMessage } from "@langchain/core/messages";

export async function composeOutreach(
  userId: string,
  leadId: string,
  businessContext?: string,
): Promise<OutreachEmail> {
  const pool = getPool();

  // Fetch lead data
  const result = await pool.query<LeadRow>(
    `SELECT * FROM public.leads WHERE id = $1 AND user_id = $2`,
    [leadId, userId],
  );

  if (result.rows.length === 0) {
    throw new Error(`Lead ${leadId} not found for user ${userId}`);
  }

  const lead = result.rows[0];

  // Build prompt using lead data + business context
  const leadContext = [
    `Company: ${lead.company_name}`,
    `Contact: ${lead.contact_name ?? "Unknown"}`,
    `Industry: ${lead.industry ?? "Unknown"}`,
    `Location: ${lead.location ?? "Unknown"}`,
    lead.website ? `Website: ${lead.website}` : null,
    lead.notes ? `\nProspect Research & Notes:\n${lead.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const businessSection = businessContext
    ? `\n\nYour Business Context:\n${businessContext}`
    : "";

  const promptContent = `Write a personalized B2B outreach email for this prospect:\n\n${leadContext}${businessSection}`;

  // Call LLM with structured output — Under 150 words, personalized, one CTA
  const { data } = await callLLMWithStructuredOutput<{
    subject: string;
    body: string;
  }>(
    [new HumanMessage(promptContent)],
    '{"subject": "string (under 10 words, compelling, no spam trigger words)", "body": "string (HTML email body, under 150 words)"}',
    {
      systemPrompt:
        'You are an expert B2B sales copywriter. Write a personalized outreach email. Rules:\n- Under 150 words\n- Highly personalized using the prospect research\n- Reference a specific pain point or talking point\n- Clear value proposition tied to the prospect\'s situation\n- One clear CTA (meeting, demo, or call)\n- Professional but conversational tone\n- No generic templates or filler phrases',
      temperature: 0.7,
    },
  );

  return {
    subject: data.subject,
    body: data.body,
    leadId,
    contactName: lead.contact_name,
    companyName: lead.company_name,
  };
}
