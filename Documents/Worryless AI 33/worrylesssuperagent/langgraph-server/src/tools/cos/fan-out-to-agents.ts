/**
 * fan-out-to-agents.ts — COS-03
 *
 * Creates a LangGraph Command with Send objects for parallel multi-agent dispatch.
 * Each targeted agent receives the full state plus goalChain context.
 *
 * This is the programmatic equivalent of the ad-hoc multi-routing in supervisor.ts,
 * but exposed as a typed tool the CoS can call explicitly.
 */

import { Command, Send } from "@langchain/langgraph";
import { AgentState } from "../../types/agent-state.js";
import type { AgentTypeId } from "../../types/agent-types.js";
import type { GoalChainEntry } from "../../types/agent-state.js";

export interface FanOutRequest {
  targetAgents: AgentTypeId[];
  goalChain?: GoalChainEntry[] | null;
  state: typeof AgentState.State;
}

/**
 * Creates a LangGraph Command with Send objects for parallel multi-agent dispatch.
 * Each targeted agent receives the full current state plus:
 *   - agentType: set to that agent's type ID
 *   - goalChain: the goal ancestry context (if provided)
 *
 * This is synchronous — just constructs Command/Send objects, no DB writes.
 */
export function createFanOutSends(request: FanOutRequest): Command {
  return new Command({
    goto: request.targetAgents.map(
      (agent) =>
        new Send(agent, {
          ...request.state,
          agentType: agent,
          goalChain: request.goalChain ?? null,
        })
    ),
  });
}
