import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

const ALLOWED_LOCATIONS = new Set([
  'united states', 'germany', 'india', 'united kingdom', 'russia', 'france',
  'china', 'canada', 'netherlands', 'mexico', 'belgium', 'japan', 'brazil',
  'australia', 'poland', 'thailand', 'sweden', 'portugal', 'spain',
  'czech republic', 'taiwan', 'south africa', 'colombia', 'italy', 'vietnam',
  'nigeria', 'singapore', 'hong kong', 'ireland', 'israel', 'switzerland',
  'turkey', 'romania', 'south korea', 'indonesia', 'united arab emirates',
  'saudi arabia', 'austria', 'philippines', 'peru', 'malaysia', 'argentina',
  'ukraine', 'ghana', 'denmark', 'norway', 'finland', 'puerto rico', 'qatar',
  'macau', 'new zealand', 'hungary', 'luxembourg', 'kuwait', 'egypt',
  'slovakia', 'greece', 'kenya', 'bulgaria', 'costa rica', 'chile',
  'venezuela', 'afghanistan', 'bangladesh', 'malta', 'guatemala', 'pakistan',
  'lithuania', 'panama', 'morocco',
]);

interface ApifyLead {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  name?: string;
  job_title?: string;
  title?: string;
  email?: string;
  personal_email?: string;
  work_email?: string;
  mobile_number?: string;
  phone?: string;
  phone_number?: string;
  linkedin?: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
  location?: string;
  company_name?: string;
  company?: string;
  organization?: string;
  company_domain?: string;
  domain?: string;
  company_website?: string;
  website?: string;
  company_linkedin?: string;
  company_size?: string;
  employees?: string;
  industry?: string;
  company_description?: string;
  description?: string;
  company_phone?: string;
  company_city?: string;
  company_state?: string;
  company_country?: string;
}

export const generateLeads = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.auth!.userId;
    const { query, location, industry, jobTitle, fetchCount = 20 } = req.body;

    const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN is not configured');
    }

    console.log('Searching leads via Apify Leads Finder:', { query, location, industry, jobTitle, fetchCount });

    // Build Apify input payload
    const apifyInput: Record<string, unknown> = {
      fetch_count: Math.min(fetchCount, 100),
    };

    if (query) {
      apifyInput.company_keywords = [query];
    }

    if (jobTitle) {
      apifyInput.contact_job_title = [jobTitle];
    }

    if (location) {
      const normalizedLocation = location.toLowerCase().trim();
      if (ALLOWED_LOCATIONS.has(normalizedLocation)) {
        apifyInput.contact_location = [normalizedLocation];
      } else {
        const parts = normalizedLocation.split(',').map((p: string) => p.trim());
        if (parts.length > 1) {
          const possibleCountry = parts[parts.length - 1];
          if (ALLOWED_LOCATIONS.has(possibleCountry)) {
            apifyInput.contact_location = [possibleCountry];
            apifyInput.contact_city = [parts[0]];
          } else {
            apifyInput.contact_city = [location];
          }
        } else {
          apifyInput.contact_city = [location];
        }
        console.log(`Location "${location}" not in allowed list, using as city filter`);
      }
    }

    if (industry) {
      apifyInput.company_industry = [industry.toLowerCase()];
    }

    console.log('Apify input:', JSON.stringify(apifyInput));

    const apifyUrl = `https://api.apify.com/v2/acts/code_crafter~leads-finder/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`;

    const apifyResponse = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyInput),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('Apify API error:', apifyResponse.status, errorText);
      throw new Error(`Apify API error: ${apifyResponse.status} - ${errorText}`);
    }

    const apifyData: ApifyLead[] = await apifyResponse.json() as ApifyLead[];

    console.log('Found', apifyData?.length || 0, 'leads from Apify');

    if (!apifyData || apifyData.length === 0) {
      res.json({
        success: true,
        leads: [],
        message: 'No leads found for this search query. Try different filters or location.',
      });
      return;
    }

    // Transform Apify leads to our database schema
    const leads = apifyData.map(lead => {
      const companyName =
        lead.company_name || lead.company || lead.organization || lead.full_name || lead.name || 'Unknown Company';
      const contactName =
        lead.full_name || lead.name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || null;
      const email = lead.email || lead.work_email || lead.personal_email || null;
      const phone = lead.mobile_number || lead.phone || lead.phone_number || lead.company_phone || null;
      const website = lead.company_website || lead.website || lead.company_domain || lead.domain || null;
      const leadLocation =
        lead.location ||
        [lead.city, lead.state, lead.country].filter(Boolean).join(', ') ||
        [lead.company_city, lead.company_state, lead.company_country].filter(Boolean).join(', ') ||
        null;
      const leadIndustry = lead.industry || industry || query;
      const companySize = lead.company_size || lead.employees || null;
      const leadJobTitle = lead.job_title || lead.title || null;
      const linkedin = lead.linkedin || lead.linkedin_url || null;
      const companyLinkedin = lead.company_linkedin || null;
      const companyDesc = lead.company_description || lead.description || null;

      return {
        user_id: userId,
        company_name: companyName,
        contact_name: contactName,
        email,
        phone,
        website,
        location: leadLocation,
        industry: leadIndustry,
        company_size: companySize,
        source: 'apify_leads_finder',
        status: 'prospecting',
        score: email ? 80 : phone ? 70 : 50,
        notes:
          [
            leadJobTitle ? `Job Title: ${leadJobTitle}` : null,
            linkedin ? `LinkedIn: ${linkedin}` : null,
            companyLinkedin ? `Company LinkedIn: ${companyLinkedin}` : null,
            companyDesc ? `Company: ${companyDesc.substring(0, 200)}` : null,
          ]
            .filter(Boolean)
            .join('\n') || null,
      };
    });

    // Insert leads into database
    const insertedLeads = [];
    for (const lead of leads) {
      try {
        const result = await pool.query(
          `INSERT INTO leads (user_id, company_name, contact_name, email, phone, website, location, industry, company_size, source, status, score, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *`,
          [
            lead.user_id, lead.company_name, lead.contact_name, lead.email,
            lead.phone, lead.website, lead.location, lead.industry,
            lead.company_size, lead.source, lead.status, lead.score, lead.notes,
          ],
        );
        insertedLeads.push(result.rows[0]);
      } catch (insertErr) {
        console.error('Error inserting lead:', insertErr);
      }
    }

    console.log('Successfully saved', insertedLeads.length, 'leads');

    res.json({
      success: true,
      leads: insertedLeads,
      saved: true,
      message: `Found and saved ${insertedLeads.length} leads with contact details`,
    });
  } catch (error: unknown) {
    console.error('Error in generate-leads:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
};
