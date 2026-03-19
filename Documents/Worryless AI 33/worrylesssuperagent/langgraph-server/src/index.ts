import express from "express";
import { Command } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { getCheckpointer } from "./persistence/checkpointer.js";
import {
  storeHealthCheck,
  putStore,
  getStore,
  searchStore,
} from "./persistence/store.js";
import { createSupervisorGraph } from "./graph/supervisor.js";
import {
  createThreadId,
  registerThread,
  listThreads,
  getThreadState,
} from "./threads/manager.js";
import type { AgentTypeId } from "./types/agent-types.js";

export const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || "3001", 10);

// ── Health Check ──────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  try {
    const checkpointer = await getCheckpointer();
    const storeOk = await storeHealthCheck();
    res.json({
      status: "ok",
      version: "1.0.0",
      checkpointer: checkpointer ? "connected" : "disconnected",
      store: storeOk ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

// ── Supervisor Graph Invoke ───────────────────────────────────────────
// POST /invoke
// Body: { message: string, user_id: string, thread_id?: string, agent_type?: string }
//
// If thread_id provided: continues existing conversation using the stored checkpoint.
// If not: creates a new thread for this user + agent combination and registers it.
//
// The supervisor graph routes the message to the appropriate specialist agent
// (or answers directly as Chief of Staff) and persists state to PostgresSaver.
app.post("/invoke", async (req, res) => {
  try {
    const { message, user_id, thread_id, agent_type, is_proactive } =
      req.body as {
        message?: unknown;
        user_id?: unknown;
        thread_id?: unknown;
        agent_type?: unknown;
        is_proactive?: unknown;
      };

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message (string) is required" });
      return;
    }
    if (!user_id || typeof user_id !== "string") {
      res.status(400).json({ error: "user_id (string) is required" });
      return;
    }

    const checkpointer = await getCheckpointer();
    const graph = createSupervisorGraph(checkpointer);

    // Determine thread: use provided thread_id or create a new one
    const agentTypeVal = (
      typeof agent_type === "string" ? agent_type : "supervisor"
    ) as AgentTypeId | "supervisor";
    const threadId =
      typeof thread_id === "string"
        ? thread_id
        : createThreadId(user_id, agentTypeVal);
    const isNewThread = !(typeof thread_id === "string");

    const config = {
      configurable: {
        thread_id: threadId,
      },
    };

    const result = await graph.invoke(
      {
        messages: [new HumanMessage(message)],
        userId: user_id,
        agentType: agentTypeVal === "supervisor" ? "" : agentTypeVal,
        isProactive: is_proactive === true, // CAD-01: bypass token budget for proactive heartbeat runs
      },
      config,
    );

    // Register the thread in the index on first use
    if (isNewThread) {
      await registerThread(user_id, agentTypeVal, threadId).catch((err) => {
        console.warn("[invoke] Failed to register thread:", err);
      });
    }

    const lastMsg = result.messages[result.messages.length - 1];

    res.json({
      response:
        typeof lastMsg.content === "string"
          ? lastMsg.content
          : JSON.stringify(lastMsg.content),
      thread_id: threadId,
      user_id,
      message_count: result.messages.length,
      agent_type: result.responseMetadata?.agentType ?? agentTypeVal,
      agent_display_name: result.responseMetadata?.agentDisplayName ?? null,
    });
  } catch (error) {
    console.error("[invoke] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ── Supervisor Graph SSE Streaming ────────────────────────────────────
// POST /invoke/stream
// Body: { message: string, user_id: string, thread_id?: string, agent_type?: string, business_context?: Record<string, unknown> }
//
// Streams the agent response as Server-Sent Events (SSE).
// Event types:
//   delta            — { type: "delta", content: string }
//   tool_start       — { type: "tool_start", tool_name: string }
//   ui_components    — { type: "ui_components", components: UIComponent[] }
//   pending_approvals — { type: "pending_approvals", approvals: PendingApproval[] }
//   done             — { type: "done", metadata: ResponseMetadata | null, thread_id: string }
//   error            — { type: "error", message: string }
app.post("/invoke/stream", async (req, res) => {
  const { message, user_id, thread_id, agent_type, business_context } =
    req.body as {
      message?: unknown;
      user_id?: unknown;
      thread_id?: unknown;
      agent_type?: unknown;
      business_context?: unknown;
    };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message (string) is required" });
    return;
  }
  if (!user_id || typeof user_id !== "string") {
    res.status(400).json({ error: "user_id (string) is required" });
    return;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const emit = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const checkpointer = await getCheckpointer();
    const graph = createSupervisorGraph(checkpointer);

    const agentTypeVal = (
      typeof agent_type === "string" ? agent_type : "supervisor"
    ) as AgentTypeId | "supervisor";
    const threadId =
      typeof thread_id === "string"
        ? thread_id
        : createThreadId(user_id, agentTypeVal);
    const isNewThread = !(typeof thread_id === "string");

    const config = {
      configurable: {
        thread_id: threadId,
      },
    };

    // Read initial uiComponents count before streaming so we only emit NEW components
    let uiComponentsBeforeCount = 0;
    try {
      const initialState = await graph.getState(config);
      uiComponentsBeforeCount =
        (initialState?.values as { uiComponents?: unknown[] } | null)
          ?.uiComponents?.length ?? 0;
    } catch {
      // thread may not exist yet — start from 0
    }

    const stream = await graph.stream(
      {
        messages: [new HumanMessage(message)],
        userId: user_id,
        agentType: agentTypeVal === "supervisor" ? "" : agentTypeVal,
        isProactive: false,
        businessContext:
          business_context && typeof business_context === "object"
            ? (business_context as Record<string, unknown>)
            : {},
      },
      { ...config, streamMode: "messages" },
    );

    let lastToolNode: string | null = null;

    for await (const chunk of stream) {
      // In "messages" streamMode, each chunk is [BaseMessage, metadata]
      const [messageChunk, metadata] = Array.isArray(chunk)
        ? chunk
        : [chunk, {}];

      // Filter: only emit AIMessage/AIMessageChunk content (skip HumanMessage echoes)
      const isAI =
        messageChunk?._getType?.() === "ai" ||
        messageChunk?.constructor?.name === "AIMessageChunk" ||
        messageChunk?.constructor?.name === "AIMessage" ||
        messageChunk instanceof AIMessage;

      if (isAI && messageChunk?.content) {
        const content =
          typeof messageChunk.content === "string"
            ? messageChunk.content
            : Array.isArray(messageChunk.content)
              ? messageChunk.content
                  .map((c: unknown) =>
                    typeof c === "object" && c !== null && "text" in c
                      ? (c as { text: string }).text
                      : "",
                  )
                  .join("")
              : "";
        if (content) {
          emit({ type: "delta", content });
        }
      }

      // Emit tool_start when we detect a tool node in the metadata
      const nodeName =
        (metadata as { langgraph_node?: string })?.langgraph_node ?? null;
      if (nodeName && nodeName !== lastToolNode && nodeName.includes("Tools")) {
        emit({ type: "tool_start", tool_name: nodeName });
        lastToolNode = nodeName;
      }
    }

    // Read final state after stream completes
    const finalState = await graph.getState(config);
    const finalValues = finalState?.values as {
      uiComponents?: unknown[];
      pendingApprovals?: unknown[];
      responseMetadata?: unknown;
    } | null;

    // Emit only NEW ui_components (since before stream started)
    const allComponents = finalValues?.uiComponents ?? [];
    const newComponents = allComponents.slice(uiComponentsBeforeCount);
    if (newComponents.length > 0) {
      emit({ type: "ui_components", components: newComponents });
    }

    // Emit pending_approvals if any
    const pendingApprovals = finalValues?.pendingApprovals ?? [];
    if (pendingApprovals.length > 0) {
      emit({ type: "pending_approvals", approvals: pendingApprovals });
    }

    // Emit done
    emit({
      type: "done",
      metadata: finalValues?.responseMetadata ?? null,
      thread_id: threadId,
    });

    res.end();

    // Register new thread (fire-and-forget)
    if (isNewThread) {
      registerThread(user_id, agentTypeVal, threadId).catch((err) => {
        console.warn("[invoke/stream] Failed to register thread:", err);
      });
    }
  } catch (error) {
    console.error("[invoke/stream] Error:", error);
    emit({
      type: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    res.end();
  }
});

// ── HITL Resume ───────────────────────────────────────────────────────
// POST /invoke/resume
// Body: { thread_id: string, approved: boolean, feedback?: string }
//
// Resumes a graph that was paused by interrupt() waiting for human approval.
// The Command({ resume: { approved, feedback } }) tells LangGraph to continue
// execution from the interrupt point with the user's decision.
app.post("/invoke/resume", async (req, res) => {
  try {
    const { thread_id, approved, feedback } = req.body as {
      thread_id?: unknown;
      approved?: unknown;
      feedback?: unknown;
    };

    if (!thread_id || typeof thread_id !== "string") {
      res.status(400).json({ error: "thread_id (string) is required" });
      return;
    }
    if (typeof approved !== "boolean") {
      res.status(400).json({ error: "approved (boolean) is required" });
      return;
    }

    const checkpointer = await getCheckpointer();
    const graph = createSupervisorGraph(checkpointer);

    const config = {
      configurable: {
        thread_id,
      },
    };

    // Resume the interrupted graph with the approval decision
    const resumeCommand = new Command({
      resume: { approved, feedback: feedback ?? null },
    });

    const result = await graph.invoke(resumeCommand, config);

    const lastMsg = result.messages[result.messages.length - 1];

    res.json({
      response:
        typeof lastMsg.content === "string"
          ? lastMsg.content
          : JSON.stringify(lastMsg.content),
      thread_id,
      approved,
      message_count: result.messages.length,
    });
  } catch (error) {
    console.error("[invoke/resume] Error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ── Thread Management ─────────────────────────────────────────────────

// POST /threads — Create a new thread (without invoking)
app.post("/threads", async (req, res) => {
  try {
    const { user_id, agent_type } = req.body as {
      user_id?: unknown;
      agent_type?: unknown;
    };

    if (!user_id || typeof user_id !== "string") {
      res.status(400).json({ error: "user_id (string) is required" });
      return;
    }

    const agentTypeVal = (
      typeof agent_type === "string" ? agent_type : "supervisor"
    ) as AgentTypeId | "supervisor";
    const threadId = createThreadId(user_id, agentTypeVal);

    await registerThread(user_id, agentTypeVal, threadId);

    res.status(201).json({
      thread_id: threadId,
      user_id,
      agent_type: agentTypeVal,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /threads/:userId — List all threads for a user
app.get("/threads/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const agentType = req.query.agent_type as string | undefined;

    const threads = await listThreads(
      userId,
      agentType as AgentTypeId | "supervisor" | undefined,
    );

    res.json({ threads, user_id: userId });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /threads/:userId/:threadId — Get thread state (last checkpoint)
app.get("/threads/:userId/:threadId", async (req, res) => {
  try {
    const { threadId } = req.params;

    const state = await getThreadState(threadId);
    if (!state) {
      res.status(404).json({ error: "Thread not found or has no checkpoint" });
      return;
    }

    res.json(state);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ── Store endpoints (infrastructure validation) ───────────────────────
app.post("/store", async (req, res) => {
  try {
    const { prefix, key, value } = req.body as {
      prefix?: unknown;
      key?: unknown;
      value?: unknown;
    };
    if (!prefix || !key || !value) {
      res.status(400).json({ error: "prefix, key, and value are required" });
      return;
    }
    await putStore(
      prefix as string,
      key as string,
      value as Record<string, unknown>,
    );
    res.json({ status: "ok", prefix, key });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/store/:prefix", async (req, res) => {
  try {
    const items = await searchStore(req.params.prefix);
    res.json({ items });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/store/:prefix/:key", async (req, res) => {
  try {
    const item = await getStore(req.params.prefix, req.params.key);
    if (!item) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ── Start Server ──────────────────────────────────────────────────────
// Only start listening when this module is run directly (not when imported for testing)
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`[langgraph-server] Running on port ${PORT}`);
    console.log(`[langgraph-server] Health: http://localhost:${PORT}/health`);
  });
}
