"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessageData, BrandFile } from "@/types";

interface UseSSEOptions {
  runId: string | null;
  onComplete?: () => void;
}

export function useSSE({ runId, onComplete }: UseSSEOptions) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [files, setFiles] = useState<BrandFile[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const addMessage = useCallback((msg: Omit<ChatMessageData, "id" | "createdAt">) => {
    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      } as ChatMessageData,
    ]);
  }, []);

  useEffect(() => {
    if (!runId) return;

    setIsRunning(true);
    const es = new EventSource(`/api/agent/stream/${runId}`);
    eventSourceRef.current = es;

    es.addEventListener("message", (e) => {
      const data = JSON.parse(e.data);
      addMessage({
        role: data.role || "agent",
        content: data.content,
        type: "text",
      });
    });

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.message);
    });

    es.addEventListener("file_card", (e) => {
      const data = JSON.parse(e.data);
      const file: BrandFile = {
        id: data.fileId || crypto.randomUUID(),
        type: data.type,
        title: data.title,
        content: data.content,
        metadata: null,
        createdAt: new Date().toISOString(),
      };
      setFiles((prev) => [...prev, file]);
      addMessage({
        role: "agent",
        content: data.title,
        type: "file_card",
        fileId: file.id,
        file,
      });
    });

    es.addEventListener("complete", () => {
      setIsRunning(false);
      setStatus(null);
      onComplete?.();
      es.close();
    });

    es.addEventListener("error", (e) => {
      setIsRunning(false);
      setStatus(null);
      if (e instanceof MessageEvent) {
        const data = JSON.parse(e.data);
        addMessage({ role: "system", content: data.message, type: "text" });
      }
      es.close();
    });

    return () => {
      es.close();
    };
  }, [runId, addMessage, onComplete]);

  return { messages, files, status, isRunning };
}
