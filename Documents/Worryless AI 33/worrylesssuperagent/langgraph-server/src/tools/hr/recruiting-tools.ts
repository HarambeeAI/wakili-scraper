// OPS-03: HR recruiting — job postings, resume screening, candidate tracking
// Queries public.candidates using shared DB pool.

import { getPool } from "../shared/db.js";
import { callLLM, callLLMWithStructuredOutput } from "../../llm/client.js";
import { HumanMessage } from "@langchain/core/messages";
import type { CandidateRow, JobPosting, ResumeScreening } from "./types.js";

/**
 * Generate a compelling job posting using the LLM.
 */
export async function createJobPosting(
  userId: string,
  title: string,
  requirements: string[],
  location: string,
  employmentType: string,
): Promise<JobPosting> {
  const requirementsList = requirements.map((r) => `- ${r}`).join("\n");
  const prompt = `Create a compelling job posting for the following role:

Title: ${title}
Location: ${location}
Employment Type: ${employmentType}
Requirements:
${requirementsList}

Generate a complete job posting with a description, full requirements list, benefits, and location.
Return JSON matching: { "title": string, "description": string, "requirements": [string], "benefits": [string], "location": string, "employmentType": string }`;

  const { data } = await callLLMWithStructuredOutput<JobPosting>(
    [new HumanMessage(prompt)],
    '{ "title": "string", "description": "string", "requirements": ["string"], "benefits": ["string"], "location": "string", "employmentType": "string" }',
    {
      systemPrompt:
        "You are an experienced talent acquisition specialist. Write compelling, inclusive job postings that attract top candidates.",
    },
  );

  return {
    title: data.title ?? title,
    description: data.description ?? "",
    requirements: data.requirements ?? requirements,
    benefits: data.benefits ?? [],
    location: data.location ?? location,
    employmentType: data.employmentType ?? employmentType,
  };
}

/**
 * Screen a candidate's resume using the LLM and update their candidate record.
 */
export async function screenResume(
  userId: string,
  candidateId: string,
  resumeText: string,
  position: string,
): Promise<ResumeScreening> {
  const schema =
    '{ "skillsScore": number, "experienceScore": number, "cultureScore": number, "overallScore": number, "strengths": ["string"], "gaps": ["string"], "recommendation": "string" }';

  const { data } = await callLLMWithStructuredOutput<{
    skillsScore: number;
    experienceScore: number;
    cultureScore: number;
    overallScore: number;
    strengths: string[];
    gaps: string[];
    recommendation: string;
  }>(
    [
      new HumanMessage(
        `Position: ${position}\n\nResume:\n${resumeText}`,
      ),
    ],
    schema,
    {
      systemPrompt:
        "You are an expert HR recruiter. Score this candidate's resume for the given position on a 0-100 scale for: skills match, experience relevance, and cultural fit. Identify strengths and gaps. Provide a hire/no-hire recommendation.",
    },
  );

  const db = getPool();
  await db.query(
    `UPDATE public.candidates
     SET skills_score = $3,
         experience_score = $4,
         culture_score = $5,
         overall_score = $6,
         status = 'screened',
         updated_at = now()
     WHERE id = $2 AND user_id = $1`,
    [
      userId,
      candidateId,
      data.skillsScore,
      data.experienceScore,
      data.cultureScore,
      data.overallScore,
    ],
  );

  // Fetch candidate name from DB for the response
  const nameResult = await db.query<{ name: string }>(
    `SELECT name FROM public.candidates WHERE id = $1 AND user_id = $2`,
    [candidateId, userId],
  );
  const name = nameResult.rows[0]?.name ?? "Unknown";

  return {
    candidateId,
    name,
    skillsScore: data.skillsScore,
    experienceScore: data.experienceScore,
    cultureScore: data.cultureScore,
    overallScore: data.overallScore,
    strengths: data.strengths,
    gaps: data.gaps,
    recommendation: `${data.recommendation} Resume screening complete. Overall score: ${data.overallScore}/100 (Skills: ${data.skillsScore}, Experience: ${data.experienceScore}, Culture: ${data.cultureScore})`,
  };
}

/**
 * Add a candidate to the tracking database.
 */
export async function trackCandidate(
  userId: string,
  name: string,
  email: string | undefined,
  position: string,
  resumeText?: string,
): Promise<{ candidateId: string; message: string }> {
  const db = getPool();
  const result = await db.query<{ id: string }>(
    `INSERT INTO public.candidates
       (user_id, name, email, position, resume_text)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      userId,
      name,
      email ?? null,
      position,
      resumeText ?? null,
    ],
  );
  const candidateId = result.rows[0].id;
  return {
    candidateId,
    message: `Candidate added: ${name} for ${position}`,
  };
}

/**
 * List candidates for a user, optionally filtered by position and/or status.
 */
export async function listCandidates(
  userId: string,
  position?: string,
  status?: string,
): Promise<{ candidates: CandidateRow[]; count: number; message: string }> {
  const db = getPool();
  const params: unknown[] = [userId];
  let query = `SELECT * FROM public.candidates WHERE user_id = $1`;

  if (position) {
    params.push(position);
    query += ` AND position = $${params.length}`;
  }
  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }

  query += ` ORDER BY overall_score DESC NULLS LAST, created_at DESC`;

  const result = await db.query<CandidateRow>(query, params);
  const rows = result.rows;

  const emptyMessage = position
    ? `No candidates found for "${position}".`
    : "No candidates found.";

  return {
    candidates: rows,
    count: rows.length,
    message: rows.length === 0 ? emptyMessage : `${rows.length} candidate(s) found.`,
  };
}
