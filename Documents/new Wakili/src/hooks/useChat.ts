/**
 * Hook for managing chat state with SSE streaming and DB persistence.
 */

import { useState, useCallback, useRef } from "react";
import {
  streamChat,
  getHistory,
  type Citation,
  type StreamEvent,
} from "../lib/api";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

let msgIdCounter = 0;
const nextId = () => String(++msgIdCounter);

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [threadId, setThreadId] = useState("");
  const [webEnabled, setWebEnabled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      // Add user message
      const userMsg: Message = { id: nextId(), role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      // Prepare streaming assistant message
      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const accumulatedCitations: Citation[] = [];
      const abort = new AbortController();
      abortRef.current = abort;

      try {
        await streamChat(
          {
            message: text,
            thread_id: threadId || undefined,
            web_enabled: webEnabled,
          },
          (event: StreamEvent) => {
            if (event.type === "token" && event.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + event.content }
                    : m,
                ),
              );
            } else if (event.type === "citations" && event.citations) {
              accumulatedCitations.push(...event.citations);
            } else if (event.type === "done") {
              if (event.thread_id) setThreadId(event.thread_id);
              // Attach all citations to the assistant message
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, citations: [...accumulatedCitations] }
                    : m,
                ),
              );
            }
          },
          abort.signal,
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      m.content ||
                      "Sorry, something went wrong. Please try again.",
                  }
                : m,
            ),
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, threadId, webEnabled],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const newThread = useCallback(() => {
    setMessages([]);
    setThreadId("");
    msgIdCounter = 0;
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try {
      const data = await getHistory(id);
      setThreadId(id);
      msgIdCounter = 0;

      const loaded: Message[] = (data.messages || []).map(
        (m: { id?: string; role: string; content: string; citations?: Citation[] }) => ({
          id: m.id || nextId(),
          role: m.role as "user" | "assistant",
          content: m.content,
          citations: m.citations || [],
        }),
      );

      setMessages(loaded);
    } catch (err) {
      console.error("Failed to load thread:", err);
    }
  }, []);

  const toggleWeb = useCallback(() => {
    setWebEnabled((prev) => !prev);
  }, []);

  return {
    messages,
    isStreaming,
    threadId,
    webEnabled,
    sendMessage,
    stopStreaming,
    newThread,
    loadThread,
    toggleWeb,
    setWebEnabled,
  };
}
