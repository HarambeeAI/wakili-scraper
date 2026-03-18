import { putStore } from "../persistence/store.js";
import { buildAgentMemoryPrefix } from "./read-memory.js";
import type { AgentTypeId } from "../types/agent-types.js";

// Creates a node function that writes updated memory back to Store
// Usage in any agent subgraph: .addNode("writeMemory", createWriteMemoryNode())
export function createWriteMemoryNode() {
  return async (state: {
    userId: string;
    agentType: string;
    memoryContext: { agentMemory: Record<string, unknown>; businessContext: Record<string, unknown> };
  }) => {
    const { userId, agentType, memoryContext } = state;

    if (!userId || !agentType || !memoryContext?.agentMemory) {
      return {}; // No-op: nothing to write
    }

    const prefix = buildAgentMemoryPrefix(userId, agentType as AgentTypeId);

    // Write each memory key back to Store
    const entries = Object.entries(memoryContext.agentMemory);
    for (const [key, value] of entries) {
      if (value && typeof value === "object") {
        await putStore(prefix, key, value as Record<string, unknown>);
      }
    }

    return {}; // State unchanged — writes are side effects to Store
  };
}
