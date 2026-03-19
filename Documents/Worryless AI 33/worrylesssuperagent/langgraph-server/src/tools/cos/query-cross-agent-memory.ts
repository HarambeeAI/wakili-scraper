/**
 * query-cross-agent-memory.ts — COS-04
 *
 * Reads memory from multiple agents' Store namespaces using the existing
 * searchStore function. Namespace pattern: "{userId}:agent_memory:{agentType}"
 *
 * If agentTypes is omitted, queries all agents except chief_of_staff.
 * Filters out agents with empty memories to reduce noise.
 */

import { AGENT_TYPES, AGENT_DISPLAY_NAMES, type AgentTypeId } from "../../types/agent-types.js";
import { searchStore } from "../../persistence/store.js";

export interface CrossAgentMemoryResult {
  agentType: AgentTypeId;
  agentDisplayName: string;
  memories: Record<string, unknown>;
}

/**
 * Reads memory from multiple agents' Store namespaces in parallel.
 * Namespace format: "{userId}:agent_memory:{agentType}"
 *
 * @param userId     The user whose agent memories to query
 * @param agentTypes Optional subset of agents to query; defaults to all except chief_of_staff
 * @returns          Array of per-agent memory maps (only agents with non-empty memories)
 */
export async function queryCrossAgentMemory(
  userId: string,
  agentTypes?: AgentTypeId[]
): Promise<CrossAgentMemoryResult[]> {
  // Default to all agent types except chief_of_staff (CoS doesn't read its own memory here)
  const targets =
    agentTypes ??
    (Object.values(AGENT_TYPES).filter(
      (t) => t !== AGENT_TYPES.CHIEF_OF_STAFF
    ) as AgentTypeId[]);

  // Query all agent namespaces in parallel
  const results = await Promise.all(
    targets.map(async (agentType) => {
      const prefix = `${userId}:agent_memory:${agentType}`;
      const items = await searchStore(prefix);

      // Convert StoreItem[] to flat Record<string, unknown>
      const memories: Record<string, unknown> = {};
      for (const item of items) {
        memories[item.key] = item.value;
      }

      const displayName =
        AGENT_DISPLAY_NAMES[agentType as keyof typeof AGENT_DISPLAY_NAMES] ??
        agentType;

      return { agentType, agentDisplayName: displayName, memories };
    })
  );

  // Filter out agents with empty memories to reduce noise
  return results.filter((r) => Object.keys(r.memories).length > 0);
}
