import { searchStore } from "../persistence/store.js";
import type { AgentTypeId } from "../types/agent-types.js";

// Prefix format: userId:agent_memory:agentType
export function buildAgentMemoryPrefix(userId: string, agentType: AgentTypeId): string {
  return `${userId}:agent_memory:${agentType}`;
}

// Prefix format: userId:business_context
export function buildBusinessContextPrefix(userId: string): string {
  return `${userId}:business_context`;
}

// Creates a node function that reads agent memory + business context from Store
// Usage in any agent subgraph: .addNode("readMemory", createReadMemoryNode())
export function createReadMemoryNode() {
  return async (state: { userId: string; agentType: string }) => {
    const { userId, agentType } = state;

    if (!userId || !agentType) {
      return {
        memoryContext: { agentMemory: {}, businessContext: {} },
      };
    }

    // Read agent-specific memory
    const agentPrefix = buildAgentMemoryPrefix(userId, agentType as AgentTypeId);
    const agentItems = await searchStore(agentPrefix);
    const agentMemory: Record<string, unknown> = {};
    for (const item of agentItems) {
      agentMemory[item.key] = item.value;
    }

    // Read shared business context
    const bizPrefix = buildBusinessContextPrefix(userId);
    const bizItems = await searchStore(bizPrefix);
    const businessContext: Record<string, unknown> = {};
    for (const item of bizItems) {
      businessContext[item.key] = item.value;
    }

    return {
      memoryContext: { agentMemory, businessContext },
    };
  };
}
