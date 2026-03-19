// SALES-02: Lead enrichment via Firecrawl website scrape + LLM synthesis

import { getPool } from "../shared/db.js";
import type { LeadRow } from "./types.js";
import { callLLMWithStructuredOutput } from "../../llm/client.js";
import { HumanMessage } from "@langchain/core/messages";

interface EnrichmentData {
  description: string;
  products: string[];
  teamSize: string;
  recentActivity: string;
  enrichedNotes: string;
}

export async function enrichLeadData(userId: string, leadId: string): Promise<LeadRow> {
  const pool = getPool();

  // Fetch the lead
  const leadResult = await pool.query<LeadRow>(
    `SELECT * FROM public.leads WHERE id = $1 AND user_id = $2`,
    [leadId, userId],
  );

  if (leadResult.rows.length === 0) {
    throw new Error(`Lead ${leadId} not found for user ${userId}`);
  }

  const lead = leadResult.rows[0];
  let pageContent = "";

  // If lead has a website, scrape it via Firecrawl
  const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (FIRECRAWL_API_KEY && lead.website) {
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: lead.website,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (scrapeResponse.ok) {
      const scrapeData = await scrapeResponse.json() as { data?: { markdown?: string } };
      pageContent = scrapeData.data?.markdown ?? "";
    }
  }

  // Build enrichment context from existing lead data + scraped content
  const context = [
    `Company: ${lead.company_name}`,
    `Contact: ${lead.contact_name ?? "Unknown"}`,
    `Industry: ${lead.industry ?? "Unknown"}`,
    `Location: ${lead.location ?? "Unknown"}`,
    lead.website ? `Website: ${lead.website}` : null,
    pageContent ? `\nWebsite content:\n${pageContent.slice(0, 10000)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Synthesize enrichment data via LLM
  const { data: enrichment } = await callLLMWithStructuredOutput<EnrichmentData>(
    [new HumanMessage(`Enrich this lead with the following information:\n\n${context}`)],
    '{"description": "string", "products": ["string"], "teamSize": "string", "recentActivity": "string", "enrichedNotes": "string"}',
    {
      systemPrompt:
        "You are a sales intelligence analyst. Extract and synthesize key information about a prospect company to help a sales rep personalize their outreach.",
      temperature: 0.2,
    },
  );

  // Append enrichment data to existing notes
  const enrichmentJson = JSON.stringify(enrichment);
  const updatedNotes = lead.notes
    ? `${lead.notes}\n\n--- Enrichment ---\n${enrichmentJson}`
    : `--- Enrichment ---\n${enrichmentJson}`;

  // Update lead notes in database
  const updateResult = await pool.query<LeadRow>(
    `UPDATE public.leads SET notes = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *`,
    [updatedNotes, leadId, userId],
  );

  return updateResult.rows[0];
}
