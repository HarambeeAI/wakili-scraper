"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessageData, BrandFile } from "@/types";

interface UseSSEOptions {
  runId: string | null;
  calendarRunId?: string | null;
  onComplete?: () => void;
  onStartCalendarWizard?: (organizationId: string) => void;
}

export function useSSE({ runId, calendarRunId, onComplete, onStartCalendarWizard }: UseSSEOptions) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [files, setFiles] = useState<BrandFile[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

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

  // Brand DNA SSE stream
  useEffect(() => {
    if (!runId) return;

    setIsRunning(true);
    const es = new EventSource(`/api/agent/stream/${runId}`);

    es.addEventListener("message", (e) => {
      const data = JSON.parse(e.data);
      addMessage({ role: data.role || "agent", content: data.content, type: "text" });
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
      addMessage({ role: "agent", content: data.title, type: "file_card", fileId: file.id, file });
    });

    es.addEventListener("start_calendar_wizard", (e) => {
      const data = JSON.parse(e.data);
      onStartCalendarWizard?.(data.organizationId);
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

    return () => { es.close(); };
  }, [runId, addMessage, onComplete, onStartCalendarWizard]);

  // Calendar agent SSE stream
  useEffect(() => {
    if (!calendarRunId) return;

    setIsRunning(true);
    const es = new EventSource(`/api/agent/calendar/stream/${calendarRunId}`);

    es.addEventListener("message", (e) => {
      const data = JSON.parse(e.data);
      addMessage({ role: data.role || "agent", content: data.content, type: "text" });
    });

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.message);
    });

    es.addEventListener("question_card", (e) => {
      const data = JSON.parse(e.data);
      addMessage({
        role: "agent",
        content: "",
        type: "question_card",
        questionData: { questions: data.questions, wizardId: data.wizardId },
      });
    });

    es.addEventListener("calendar_preview", (e) => {
      const data = JSON.parse(e.data);
      addMessage({
        role: "agent",
        content: "",
        type: "calendar_preview",
        calendarPreviewData: {
          calendarId: data.calendarId,
          posts: data.posts,
          platforms: data.platforms,
          weekCount: data.weekCount,
        },
      });
    });

    es.addEventListener("content_preview", (e) => {
      const data = JSON.parse(e.data);
      addMessage({
        role: "agent",
        content: "",
        type: "content_preview",
        contentPreviewData: {
          postId: data.postId,
          mediaUrl: data.mediaUrl,
          mediaType: data.mediaType,
          caption: data.caption,
          platform: data.platform,
        },
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

    return () => { es.close(); };
  }, [calendarRunId, addMessage, onComplete]);

  return { messages, files, status, isRunning, addMessage };
}
