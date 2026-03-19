// SALES-01: Lead generation via Apify REST API with ON CONFLICT dedup on (user_id, email)

import { getPool } from "../shared/db.js";
import type { GenerateLeadsInput, LeadRow, ApifyLead } from "./types.js";

export async function generateLeads(input: GenerateLeadsInput): Promise<LeadRow[]> {
  const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
  if (!APIFY_API_TOKEN) {
    throw new Error("APIFY_API_TOKEN not configured — add your Apify API key in Settings.");
  }

  // Build Apify input payload
  const apifyInput: Record<string, unknown> = {
    fetch_count: Math.min(input.fetchCount ?? 20, 20), // Cap at 20 for LangGraph (shorter timeout than Edge Function)
  };

  if (input.query) apifyInput.company_keywords = [input.query];
  if (input.jobTitle) apifyInput.contact_job_title = [input.jobTitle];
  if (input.location) apifyInput.contact_location = [input.location.toLowerCase()];
  if (input.industry) apifyInput.company_industry = [input.industry.toLowerCase()];

  // Fetch from Apify sync endpoint
  const apifyUrl = `https://api.apify.com/v2/acts/code_crafter~leads-finder/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`;

  const response = await fetch(apifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(apifyInput),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apify API error: ${response.status} - ${errorText}`);
  }

  const data: ApifyLead[] = await response.json() as ApifyLead[];

  if (!data || data.length === 0) {
    return [];
  }

  const pool = getPool();
  const upsertedLeads: LeadRow[] = [];

  for (const apifyLead of data) {
    // Map Apify fields to our schema
    const companyName =
      apifyLead.company_name ||
      apifyLead.contact_full_name ||
      "Unknown Company";
    const contactName = apifyLead.contact_full_name ?? null;
    const email = apifyLead.contact_email || null;
    const phone = apifyLead.contact_phone || null;
    const website = apifyLead.company_website || null;
    const industry = apifyLead.company_industry || input.industry || null;
    const companySize = apifyLead.company_employee_count || null;
    const location = apifyLead.contact_location || null;

    // Build notes from linkedin and other context
    const notesParts: string[] = [];
    if (apifyLead.contact_linkedin_url) {
      notesParts.push(`LinkedIn: ${apifyLead.contact_linkedin_url}`);
    }
    const notes = notesParts.length > 0 ? notesParts.join("\n") : null;

    if (email) {
      // CRITICAL dedup: Upsert on partial unique index (user_id, email) WHERE email IS NOT NULL
      const result = await pool.query<LeadRow>(
        `INSERT INTO public.leads (user_id, company_name, contact_name, email, phone, website, industry, company_size, location, status, score, notes, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'prospecting', 0, $10, 'apify_leads_finder')
         ON CONFLICT (user_id, email) WHERE email IS NOT NULL
         DO UPDATE SET
           updated_at = NOW(),
           notes = EXCLUDED.notes,
           phone = COALESCE(EXCLUDED.phone, public.leads.phone),
           website = COALESCE(EXCLUDED.website, public.leads.website),
           industry = COALESCE(EXCLUDED.industry, public.leads.industry),
           company_size = COALESCE(EXCLUDED.company_size, public.leads.company_size),
           location = COALESCE(EXCLUDED.location, public.leads.location)
         RETURNING *`,
        [
          input.userId,
          companyName,
          contactName,
          email,
          phone,
          website,
          industry,
          companySize,
          location,
          notes,
        ],
      );
      if (result.rows.length > 0) {
        upsertedLeads.push(result.rows[0]);
      }
    } else {
      // No email: plain INSERT (partial unique index does not cover these rows)
      const result = await pool.query<LeadRow>(
        `INSERT INTO public.leads (user_id, company_name, contact_name, email, phone, website, industry, company_size, location, status, score, notes, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'prospecting', 0, $10, 'apify_leads_finder')
         RETURNING *`,
        [
          input.userId,
          companyName,
          contactName,
          null,
          phone,
          website,
          industry,
          companySize,
          location,
          notes,
        ],
      );
      if (result.rows.length > 0) {
        upsertedLeads.push(result.rows[0]);
      }
    }
  }

  return upsertedLeads;
}
