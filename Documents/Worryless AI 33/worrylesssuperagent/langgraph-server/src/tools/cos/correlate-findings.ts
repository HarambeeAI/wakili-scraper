/**
 * correlate-findings.ts — COS-05
 *
 * Uses callLLMWithStructuredOutput to detect cross-agent patterns and
 * connections in concurrent heartbeat findings. Helps the Chief of Staff
 * identify when multiple agent findings are symptoms of the same root cause.
 */

import { HumanMessage } from "@langchain/core/messages";
import { callLLMWithStructuredOutput } from "../../llm/client.js";

export interface FindingInput {
  agentTypeId: string;
  summary: string;
  outcome: string;
}

export interface Correlation {
  agents: string[];
  connection: string;
  urgency: "high" | "medium" | "low";
  recommendation: string;
}

export interface CorrelationResult {
  correlations: Correlation[];
  standaloneFindings: string[]; // agent_type_ids with no correlations
}

const CORRELATE_SCHEMA = `{
  "correlations": [
    {
      "agents": ["agent_type_id1", "agent_type_id2"],
      "connection": "one-sentence synthesis of what links these findings",
      "urgency": "high|medium|low",
      "recommendation": "one-sentence action for the Chief of Staff to take"
    }
  ],
  "standalone_findings": ["agent_type_id"]
}`;

const CORRELATE_SYSTEM_PROMPT =
  "You are a strategic business analyst. Identify when agent findings are symptoms of the same root cause. Be concise.";

/**
 * Detects cross-agent patterns in concurrent heartbeat findings using LLM structured output.
 * Returns correlations (linked findings) and standalone findings (no detected connection).
 *
 * Returns empty correlations immediately if fewer than 2 findings are provided
 * (no correlation is possible with a single finding).
 */
export async function correlateFindings(
  // userId is reserved for future audit logging in Plan 04
  _userId: string,
  findings: FindingInput[],
): Promise<CorrelationResult> {
  // No correlation possible with fewer than 2 findings
  if (findings.length < 2) {
    return {
      correlations: [],
      standaloneFindings: findings.map((f) => f.agentTypeId),
    };
  }

  const prompt =
    `Analyze these concurrent agent findings for the same business and identify any connections or patterns:\n\n` +
    findings.map((f) => `[${f.agentTypeId}]: ${f.summary}`).join("\n");

  const { data } = await callLLMWithStructuredOutput<{
    correlations: Correlation[];
    standalone_findings: string[];
  }>([new HumanMessage(prompt)], CORRELATE_SCHEMA, {
    systemPrompt: CORRELATE_SYSTEM_PROMPT,
    temperature: 0.3,
  });

  // Map standalone_findings (snake_case from LLM) to standaloneFindings (camelCase)
  return {
    correlations: data.correlations ?? [],
    standaloneFindings: data.standalone_findings ?? [],
  };
}
