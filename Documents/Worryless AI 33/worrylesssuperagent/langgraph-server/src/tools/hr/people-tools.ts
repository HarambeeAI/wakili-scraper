// OPS-03: HR people management — onboarding plans + performance reviews
// Both tools are LLM-only (no direct DB writes for these outputs).

import { callLLM, callLLMWithStructuredOutput } from "../../llm/client.js";
import { HumanMessage } from "@langchain/core/messages";
import type { OnboardingPlan } from "./types.js";

/**
 * Generate a 30/60/90-day onboarding plan for a new hire using the LLM.
 */
export async function createOnboardingPlan(
  userId: string,
  candidateName: string,
  position: string,
): Promise<OnboardingPlan> {
  const schema =
    '{ "candidateName": "string", "position": "string", "milestones": [{ "day": number, "task": "string", "owner": "string" }] }';

  const { data } = await callLLMWithStructuredOutput<OnboardingPlan>(
    [
      new HumanMessage(
        `Create a 30/60/90-day onboarding plan for ${candidateName} joining as ${position}.`,
      ),
    ],
    schema,
    {
      systemPrompt:
        "You are an HR specialist. Create structured onboarding plans with clear milestones at days 1, 7, 14, 30, 60, and 90. Assign each task to an owner: 'HR', 'Manager', 'IT', or 'New Hire'.",
    },
  );

  return {
    candidateName: data.candidateName ?? candidateName,
    position: data.position ?? position,
    milestones: data.milestones ?? [],
  };
}

/**
 * Draft a structured performance review for an employee using the LLM.
 */
export async function performanceReview(
  userId: string,
  employeeName: string,
  role: string,
  achievements: string,
  areas: string,
): Promise<{ review: string; message: string }> {
  const prompt = `Draft a professional performance review for:

Employee: ${employeeName}
Role: ${role}
Key Achievements: ${achievements}
Areas for Development: ${areas}

Include sections: Summary, Achievements, Areas for Development, Goals for Next Period, and Overall Rating (1-5 scale with justification).`;

  const { content } = await callLLM([new HumanMessage(prompt)], {
    systemPrompt:
      "You are an experienced HR manager. Write balanced, constructive performance reviews that motivate employees while identifying clear growth opportunities.",
  });

  return {
    review: content,
    message: `Performance review drafted for ${employeeName}`,
  };
}
