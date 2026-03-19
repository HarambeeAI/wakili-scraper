// process-tools.ts — SOP drafting and process documentation (OPS-07)

import { HumanMessage } from "@langchain/core/messages";
import { callLLMWithStructuredOutput } from "../../llm/client.js";
import type { SOPDocument } from "./types.js";

// OPS-07: Draft a Standard Operating Procedure for a given business process
export async function draftSOP(
  userId: string,
  processName: string,
  context?: string,
): Promise<SOPDocument & { message: string }> {
  const userContent = context
    ? `Process to document: "${processName}"\nAdditional context: ${context}`
    : `Process to document: "${processName}"`;

  const schemaDescription =
    '{ "title": "string", "purpose": "string", "steps": [{ "stepNumber": number, "action": "string", "responsible": "string", "notes": "string" }] }';

  const { data } = await callLLMWithStructuredOutput<{
    title: string;
    purpose: string;
    steps: Array<{ stepNumber: number; action: string; responsible: string; notes: string }>;
  }>(
    [new HumanMessage(userContent)],
    schemaDescription,
    {
      systemPrompt:
        "Draft a Standard Operating Procedure. Be specific and actionable. Each step should be clear enough for someone unfamiliar with the process.",
      temperature: 0.3,
    },
  );

  return {
    title: data.title,
    purpose: data.purpose,
    steps: data.steps,
    message: `SOP drafted: "${data.title}"`,
  };
}
