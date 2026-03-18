import { getCheckpointer } from "../persistence/checkpointer.js";
import { searchStore, putStore } from "../persistence/store.js";
import type { AgentTypeId } from "../types/agent-types.js";

export interface ThreadInfo {
  threadId: string;
  userId: string;
  agentType: AgentTypeId | "supervisor";
  createdAt: string;
}

// Generate a new unique thread ID.
// Format: {userId}:{agentType}:{timestamp}
// This allows easy filtering by userId and agentType prefix.
export function createThreadId(userId: string, agentType: AgentTypeId | "supervisor"): string {
  return `${userId}:${agentType}:${Date.now()}`;
}

// Parse a thread ID back into its components.
export function parseThreadId(threadId: string): ThreadInfo | null {
  const parts = threadId.split(":");
  if (parts.length < 3) return null;
  return {
    threadId,
    userId: parts[0],
    agentType: parts[1] as AgentTypeId | "supervisor",
    createdAt: new Date(parseInt(parts[2], 10)).toISOString(),
  };
}

// Retrieve the last checkpoint state for a thread.
// Returns null if no checkpoint exists (new or unknown thread).
export async function getThreadState(threadId: string) {
  const checkpointer = await getCheckpointer();
  const config = { configurable: { thread_id: threadId } };

  try {
    const checkpoint = await checkpointer.getTuple(config);
    if (!checkpoint) return null;
    return {
      threadId,
      checkpoint: checkpoint.checkpoint,
      metadata: checkpoint.metadata,
      parentConfig: checkpoint.parentConfig,
    };
  } catch {
    return null;
  }
}

// ── Thread Index (Store-based) ─────────────────────────────────────────────────
//
// PostgresSaver does not natively support listing threads by user.
// We maintain a secondary index in the LangGraph Store keyed by userId.

function buildThreadIndexPrefix(userId: string): string {
  return `${userId}:thread_index`;
}

// Register a new thread in the per-user index.
// Called once when a new thread is created (first /invoke without a thread_id).
export async function registerThread(
  userId: string,
  agentType: AgentTypeId | "supervisor",
  threadId: string
): Promise<void> {
  const prefix = buildThreadIndexPrefix(userId);
  await putStore(prefix, threadId, {
    agentType,
    createdAt: new Date().toISOString(),
  });
}

// List all threads for a user, optionally filtered by agent type.
// Returns threads ordered by most-recently-updated (from Store).
export async function listThreads(
  userId: string,
  agentType?: AgentTypeId | "supervisor"
): Promise<ThreadInfo[]> {
  const prefix = buildThreadIndexPrefix(userId);
  const items = await searchStore(prefix);

  return items
    .filter((item) => {
      if (!agentType) return true;
      return (item.value as Record<string, unknown>).agentType === agentType;
    })
    .map((item) => ({
      threadId: item.key,
      userId,
      agentType: (item.value as Record<string, unknown>).agentType as AgentTypeId | "supervisor",
      createdAt: (item.value as Record<string, unknown>).createdAt as string,
    }));
}
