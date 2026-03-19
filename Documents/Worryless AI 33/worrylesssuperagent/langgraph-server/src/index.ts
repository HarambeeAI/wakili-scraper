import express from "express";
import { Command } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
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

const app = express();
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
app.listen(PORT, () => {
  console.log(`[langgraph-server] Running on port ${PORT}`);
  console.log(`[langgraph-server] Health: http://localhost:${PORT}/health`);
});
