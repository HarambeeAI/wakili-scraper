/**
 * chief-of-staff.ts — CoS-specific agent module
 *
 * Exports `createCosToolsNode`, a factory that produces the data-gathering node
 * for the supervisor graph. This node runs BEFORE the router/respond nodes and
 * injects tool results into state.businessContext.cosToolResults so the LLM has
 * real business data to work with.
 *
 * Tool execution is DETERMINISTIC based on request classification (not LLM function-calling).
 * This is the "CoS as strategic orchestrator" pattern from 12-RESEARCH.md.
 */

import { AgentState } from "../types/agent-state.js";
import {
  compileMorningBriefing,
  assessAgentHealth,
  trackActionItems,
  correlateFindings,
  queryCrossAgentMemory,
  type FindingInput,
} from "../tools/cos/index.js";
import { writeAuditLog } from "../governance/audit-log.js";

// ── Request Classification ─────────────────────────────────────────────────────

interface RequestClassification {
  isBriefing: boolean;
  isHealthCheck: boolean;
  isStatusQuery: boolean;
}

/**
 * Classifies the incoming request using keyword heuristics.
 * Deterministic — no LLM call required for classification.
 */
function classifyRequest(lastMessage: string): RequestClassification {
  const lower = lastMessage.toLowerCase();
  return {
    isBriefing: /\b(brief|morning|digest|overview|what.?s.*happening|catch.*up|daily|summary)\b/.test(lower),
    isHealthCheck: /\b(health|status|agents?.*doing|team.*status|agent.*health|how.*team)\b/.test(lower),
    isStatusQuery: /\b(action.*items?|pending|tasks?|follow.*up|track|what.?s.*open)\b/.test(lower),
  };
}

// ── CoS Tools Node Factory ─────────────────────────────────────────────────────

/**
 * Creates the CoS data-gathering node for the supervisor graph.
 *
 * This node runs BEFORE the router/respond nodes and injects tool results
 * into state.businessContext so the LLM has real data to work with.
 *
 * Tool execution is deterministic based on request classification:
 * - Briefing requests -> compileMorningBriefing + correlateFindings
 * - Health check requests -> assessAgentHealth (always run)
 * - Status queries -> trackActionItems
 * - Briefing or health check -> queryCrossAgentMemory for synthesis
 * - All requests -> assessAgentHealth (lightweight, always useful)
 */
export function createCosToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const classification = classifyRequest(content);
    const toolResults: Record<string, unknown> = {};

    // Always run lightweight health check — always useful for CoS context
    try {
      const health = await assessAgentHealth(state.userId);
      toolResults.agentHealth = health;
    } catch (err) {
      console.error("[cos-tools] assessAgentHealth failed:", err);
    }

    // Briefing requests: full morning briefing + optional correlation
    if (classification.isBriefing) {
      try {
        const briefing = await compileMorningBriefing(state.userId);
        toolResults.morningBriefing = briefing;

        // GOV-01: Write audit log for briefing compilation (fire-and-forget)
        writeAuditLog({
          userId: state.userId,
          agentTypeId: "chief_of_staff",
          action: "briefing",
          input: { classification: "morning_briefing" },
          output: {
            urgentCount: briefing.urgent.length,
            priorityCount: briefing.priorities.length,
            fyiCount: briefing.fyi.length,
          },
          tokensUsed: 0,
          goalChain: state.goalChain ?? null,
        }).catch((err) => console.error("[audit-log] Briefing audit failed:", err));

        // If 2+ heartbeat findings exist, run correlation for cross-agent pattern detection
        const allFindings = [...briefing.urgent, ...briefing.priorities].filter(
          (item) => item.source === "heartbeat" && item.agentTypeId,
        );
        if (allFindings.length >= 2) {
          const findingInputs: FindingInput[] = allFindings.map((f) => ({
            agentTypeId: f.agentTypeId!,
            summary: f.summary,
            outcome: f.urgency === "high" ? "error" : "surfaced",
          }));
          const correlations = await correlateFindings(state.userId, findingInputs);
          toolResults.correlations = correlations;
        }
      } catch (err) {
        console.error("[cos-tools] compileMorningBriefing failed:", err);
      }
    }

    // Status/action item queries
    if (classification.isStatusQuery) {
      try {
        const actionItems = await trackActionItems(state.userId);
        toolResults.actionItems = actionItems;
      } catch (err) {
        console.error("[cos-tools] trackActionItems failed:", err);
      }
    }

    // Cross-agent memory query for synthesis (only on briefing or health check)
    if (classification.isBriefing || classification.isHealthCheck) {
      try {
        const memories = await queryCrossAgentMemory(state.userId);
        if (memories.length > 0) {
          toolResults.crossAgentInsights = memories.map((m) => ({
            agent: m.agentDisplayName,
            keyLearnings: Object.keys(m.memories).slice(0, 5),
          }));
        }
      } catch (err) {
        console.error("[cos-tools] queryCrossAgentMemory failed:", err);
      }
    }

    // Merge tool results into businessContext for downstream LLM nodes
    return {
      businessContext: {
        ...state.businessContext,
        cosToolResults: toolResults,
      },
    };
  };
}
