/**
 * delegate-to-agent.ts — COS-02
 *
 * Creates a LangGraph Command that routes to a specialist agent with full
 * goal ancestry context. The goalChain flows into the delegated agent's
 * state so it understands WHY it's doing the work.
 *
 * The delegation audit log entry is written by the supervisor integration
 * in Plan 04, not here — this function is deliberately side-effect-free.
 */

import { Command } from "@langchain/langgraph";
import type { AgentTypeId } from "../../types/agent-types.js";
import type { GoalChainEntry } from "../../types/agent-state.js";

export interface DelegationRequest {
  targetAgent: AgentTypeId;
  goalChain: GoalChainEntry[];
  taskDescription?: string;
}

/**
 * Creates a LangGraph Command that routes to a specialist agent with full goal ancestry.
 * The goalChain flows into the delegated agent's state so it understands WHY it's doing the work.
 *
 * This is synchronous — it just creates a Command object. No DB writes occur here.
 * The supervisor integration (Plan 04) handles audit logging.
 */
export function createDelegationCommand(request: DelegationRequest): Command {
  return new Command({
    goto: request.targetAgent,
    update: {
      agentType: request.targetAgent,
      goalChain: request.goalChain,
    },
  });
}
