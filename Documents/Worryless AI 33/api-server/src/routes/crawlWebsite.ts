import type { Response } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { pool } from "../db/pool.js";
import { getGeminiOpenAI } from "../lib/gemini.js";

const systemInstruction = `You are a business analyst expert. Extract structured information from website content. Return a JSON object with the following structure:
{
  "company_description": "brief description of what the company does",
  "products_services": [{"name": "product/service name", "description": "brief description"}],
  "target_audience": "who the company serves",
  "value_propositions": ["key value prop 1", "key value prop 2"],
  "brand_tone": "description of brand voice/tone",
  "key_features": ["feature 1", "feature 2"],
  "contact_info": {"email": "", "phone": "", "address": ""},
  "social_links": ["url1", "url2"],
  "testimonials": [{"quote": "", "author": ""}],
  "team_members": [{"name": "", "role": ""}]
}
Only include fields where you find actual information. Return valid JSON only, no markdown formatting.`;

export const crawlWebsite = async (
  req: AuthedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.auth!.userId;
    const { websiteUrl, businessName, industry, description } = req.body;

    if (!websiteUrl) {
      res.status(400).json({ error: "Website URL is required" });
      return;
    }

    const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
    if (!FIRECRAWL_API_KEY) {
      throw new Error("FIRECRAWL_API_KEY is not configured");
    }

    console.log(`Starting crawl for website: ${websiteUrl}`);

    // Update profile with basic info first
    await pool.query(
      `UPDATE profiles SET website = $1, business_name = $2, industry = $3, company_description = $4 WHERE user_id = $5`,
      [websiteUrl, businessName, industry, description, userId],
    );

    // Step 1: Map the website to discover URLs
    console.log("Mapping website URLs...");
    const mapResponse = await fetch("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: websiteUrl,
        limit: 20,
        includeSubdomains: false,
      }),
    });

    if (!mapResponse.ok) {
      const errorText = await mapResponse.text();
      console.error("Map error:", errorText);
      throw new Error(`Failed to map website: ${errorText}`);
    }

    const mapData = await mapResponse.json();
    const urls: string[] = mapData.links || [websiteUrl];
    console.log(`Found ${urls.length} URLs to crawl`);

    // Step 2: Scrape the main page with branding info
    console.log("Scraping main page with branding...");
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: websiteUrl,
        formats: ["markdown", "links", "screenshot"],
        onlyMainContent: true,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error("Scrape error:", errorText);
      throw new Error(`Failed to scrape website: ${errorText}`);
    }

    const scrapeData = await scrapeResponse.json();
    const pageContent: string = scrapeData.data?.markdown || "";
    const screenshot: string | undefined = scrapeData.data?.screenshot;

    console.log("Analyzing content with AI...");

    // Step 3: Use Gemini to extract structured information
    const aiResponse = await getGeminiOpenAI().chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: systemInstruction },
        {
          role: "user",
          content: `Analyze this website content and extract business information:\n\n${pageContent.substring(0, 15000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const aiContent = aiResponse.choices?.[0]?.message?.content || "";

    // Parse AI response
    let extractedInfo: Record<string, any>;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      extractedInfo = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      console.error("Failed to parse AI response");
      extractedInfo = {};
    }

    console.log("Saving artifacts to database...");

    // Step 4: Save artifacts to database
    interface Artifact {
      user_id: string;
      artifact_type: string;
      title: string;
      content?: string;
      image_url?: string;
      metadata?: Record<string, any>;
      source_url: string;
    }
    const artifacts: Artifact[] = [];

    if (extractedInfo.company_description) {
      artifacts.push({
        user_id: userId,
        artifact_type: "description",
        title: "Company Overview",
        content: extractedInfo.company_description,
        source_url: websiteUrl,
      });
    }

    if (extractedInfo.products_services?.length) {
      for (const item of extractedInfo.products_services) {
        artifacts.push({
          user_id: userId,
          artifact_type: "product",
          title: item.name,
          content: item.description,
          source_url: websiteUrl,
        });
      }
    }

    if (extractedInfo.target_audience) {
      artifacts.push({
        user_id: userId,
        artifact_type: "description",
        title: "Target Audience",
        content: extractedInfo.target_audience,
        source_url: websiteUrl,
      });
    }

    if (extractedInfo.brand_tone) {
      artifacts.push({
        user_id: userId,
        artifact_type: "description",
        title: "Brand Voice & Tone",
        content: extractedInfo.brand_tone,
        source_url: websiteUrl,
      });
    }

    if (extractedInfo.value_propositions?.length) {
      artifacts.push({
        user_id: userId,
        artifact_type: "description",
        title: "Value Propositions",
        content: extractedInfo.value_propositions.join("\n- "),
        source_url: websiteUrl,
      });
    }

    if (extractedInfo.key_features?.length) {
      artifacts.push({
        user_id: userId,
        artifact_type: "description",
        title: "Key Features",
        content: extractedInfo.key_features.join("\n- "),
        source_url: websiteUrl,
      });
    }

    if (extractedInfo.contact_info) {
      artifacts.push({
        user_id: userId,
        artifact_type: "contact",
        title: "Contact Information",
        content: JSON.stringify(extractedInfo.contact_info),
        metadata: extractedInfo.contact_info,
        source_url: websiteUrl,
      });
    }

    if (extractedInfo.testimonials?.length) {
      for (const testimonial of extractedInfo.testimonials) {
        if (testimonial.quote) {
          artifacts.push({
            user_id: userId,
            artifact_type: "testimonial",
            title: testimonial.author || "Customer Testimonial",
            content: testimonial.quote,
            source_url: websiteUrl,
          });
        }
      }
    }

    if (extractedInfo.team_members?.length) {
      for (const member of extractedInfo.team_members) {
        if (member.name) {
          artifacts.push({
            user_id: userId,
            artifact_type: "team_member",
            title: member.name,
            content: member.role || "Team Member",
            source_url: websiteUrl,
          });
        }
      }
    }

    if (screenshot) {
      artifacts.push({
        user_id: userId,
        artifact_type: "image",
        title: "Homepage Screenshot",
        image_url: screenshot,
        source_url: websiteUrl,
      });
    }

    if (urls.length > 0) {
      artifacts.push({
        user_id: userId,
        artifact_type: "description",
        title: "Website Pages",
        content: urls.slice(0, 20).join("\n"),
        metadata: { urls: urls.slice(0, 20) },
        source_url: websiteUrl,
      });
    }

    // Insert all artifacts
    if (artifacts.length > 0) {
      for (const artifact of artifacts) {
        await pool.query(
          `INSERT INTO business_artifacts (user_id, artifact_type, title, content, image_url, metadata, source_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            artifact.user_id,
            artifact.artifact_type,
            artifact.title,
            artifact.content || null,
            artifact.image_url || null,
            artifact.metadata ? JSON.stringify(artifact.metadata) : null,
            artifact.source_url,
          ],
        );
      }
    }

    // Mark onboarding as completed
    await pool.query(
      `UPDATE profiles SET onboarding_completed = true WHERE user_id = $1`,
      [userId],
    );

    console.log(`Successfully saved ${artifacts.length} artifacts`);

    res.json({
      success: true,
      artifactsCount: artifacts.length,
      extractedInfo,
    });
  } catch (error: unknown) {
    console.error("Error in crawl-business-website:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
};
