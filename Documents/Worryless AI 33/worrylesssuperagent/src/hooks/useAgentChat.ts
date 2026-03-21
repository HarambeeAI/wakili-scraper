import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UIComponent {
  type: string;
  props: Record<string, unknown>;
}

export interface PendingApproval {
  id: string;
  action: string;
  agentType: string;
  description: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  uiComponents?: UIComponent[];
  pendingApproval?: PendingApproval;
}

export interface ThreadInfo {
  thread_id: string;
  agent_type: string;
  created_at: string;
  title?: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAgentChat({
  userId,
  agentType,
}: {
  userId: string;
  agentType: string;
}) {
  const { token } = useAuth();

  const API_URL = import.meta.env.VITE_API_URL as string;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>(
    [],
  );

  // Track the current streaming assistant message id via ref (stable across renders)
  const streamingMsgIdRef = useRef<string | null>(null);

  // ── Load threads on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !token) return;

    async function loadThreads() {
      try {
        const url = `${API_URL}/api/langgraph-proxy/threads/${userId}?agent_type=${agentType}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return;

        const data = (await response.json()) as { threads: ThreadInfo[] };
        setThreads(data.threads ?? []);

        // Auto-select most recent thread if none active
        if (data.threads?.length > 0 && !activeThreadId) {
          setActiveThreadId(data.threads[0].thread_id);
        }
      } catch (err) {
        console.error("[useAgentChat] Failed to load threads:", err);
      }
    }

    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, agentType, API_URL, token]);

  // ── Load thread state when activeThreadId changes ──────────────────────────
  useEffect(() => {
    if (!activeThreadId || !userId || !token) return;

    async function loadThreadState() {
      try {
        const url = `${API_URL}/api/langgraph-proxy/threads/${userId}/${activeThreadId}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return;

        const state = (await response.json()) as {
          values?: { messages?: Array<{ type: string; content: string }> };
        };

        if (state?.values?.messages) {
          const loadedMessages: ChatMessage[] = state.values.messages
            .filter((m) => m.type === "human" || m.type === "ai")
            .map((m, idx) => ({
              id: `loaded-${idx}`,
              role: m.type === "human" ? "user" : "assistant",
              content:
                typeof m.content === "string"
                  ? m.content
                  : JSON.stringify(m.content),
            }));
          setMessages(loadedMessages);
        }
      } catch (err) {
        console.error("[useAgentChat] Failed to load thread state:", err);
      }
    }

    loadThreadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  // ── sendMessage ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();
      streamingMsgIdRef.current = assistantMsgId;

      // Optimistic: add user message immediately
      const userMsg: ChatMessage = {
        id: userMsgId,
        role: "user",
        content: text,
      };
      const assistantPlaceholder: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setIsStreaming(true);

      try {
        // Fetch business_stage from /api/profiles/me
        const profile = await api.get<{ business_stage?: string | null }>("/api/profiles/me", { token });
        const businessContext: Record<string, unknown> = {
          business_stage: profile?.business_stage ?? null,
        };

        // ── LangGraph SSE streaming path (always, per D-18) ───────────────
        const streamUrl = `${API_URL}/api/langgraph-proxy/invoke/stream`;
        const response = await fetch(streamUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text,
            user_id: userId,
            thread_id: activeThreadId,
            agent_type: agentType,
            business_context: businessContext,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Request failed: ${response.status}`);
        }

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr) as {
                type: string;
                content?: string;
                tool_name?: string;
                components?: UIComponent[];
                approvals?: PendingApproval[];
                metadata?: Record<string, unknown> | null;
                thread_id?: string;
                message?: string;
              };

              if (data.type === "delta" && data.content) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + data.content! }
                      : m,
                  ),
                );
              } else if (data.type === "tool_start" && data.tool_name) {
                setActiveToolName(data.tool_name);
              } else if (data.type === "ui_components" && data.components) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, uiComponents: data.components }
                      : m,
                  ),
                );
              } else if (
                data.type === "pending_approvals" &&
                data.approvals?.length
              ) {
                // Attach first approval to the streaming assistant message
                // so AgentChatView renders HITLApprovalCard inline
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, pendingApproval: data.approvals![0] }
                      : m,
                  ),
                );
                // Also maintain the pendingApprovals array for multi-approval flows
                setPendingApprovals((prev) => [
                  ...prev,
                  ...(data.approvals ?? []),
                ]);
              } else if (data.type === "done") {
                setIsStreaming(false);
                setActiveToolName(null);
                // Set activeThreadId if not already set
                if (!activeThreadId && data.thread_id) {
                  setActiveThreadId(data.thread_id);
                }
                // Finalize assistant message (remove isStreaming flag)
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, isStreaming: false }
                      : m,
                  ),
                );
              } else if (data.type === "error") {
                setIsStreaming(false);
                console.error("[useAgentChat] Stream error:", data.message);
              }
            } catch {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      } catch (err) {
        console.error("[useAgentChat] sendMessage error:", err);
        // Remove optimistic messages on error
        setMessages((prev) =>
          prev.filter((m) => m.id !== userMsgId && m.id !== assistantMsgId),
        );
        setIsStreaming(false);
        streamingMsgIdRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, agentType, activeThreadId, isStreaming, API_URL, token],
  );

  // ── approveHITL ───────────────────────────────────────────────────────────
  const approveHITL = useCallback(
    async (threadId: string, approved: boolean, feedback?: string) => {
      try {
        const resumeUrl = `${API_URL}/api/langgraph-proxy/invoke/resume`;
        const response = await fetch(resumeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            thread_id: threadId,
            approved,
            feedback: feedback ?? null,
          }),
        });

        if (!response.ok) {
          throw new Error(`Resume request failed: ${response.status}`);
        }

        // Remove the matching pending approval
        setPendingApprovals((prev) => prev.filter((a) => a.id !== threadId));

        // Add status message to chat
        const statusMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: approved
            ? "Action approved. Continuing..."
            : "Action rejected.",
          isStreaming: false,
        };
        setMessages((prev) => [...prev, statusMsg]);
      } catch (err) {
        console.error("[useAgentChat] approveHITL error:", err);
      }
    },
    [API_URL, token],
  );

  // ── startNewThread ────────────────────────────────────────────────────────
  const startNewThread = useCallback(() => {
    setActiveThreadId(null);
    setMessages([]);
    setPendingApprovals([]);
    setActiveToolName(null);
  }, []);

  return {
    messages,
    threads,
    activeThreadId,
    setActiveThreadId,
    isStreaming,
    activeToolName,
    pendingApprovals,
    sendMessage,
    approveHITL,
    startNewThread,
  };
}
