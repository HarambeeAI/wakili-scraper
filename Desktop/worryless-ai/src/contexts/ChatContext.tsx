"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { ChatMessageData, BrandFile } from "@/types";
import type { WizardAnswers } from "@/types/calendar";

interface ChatContextValue {
  messages: ChatMessageData[];
  files: BrandFile[];
  status: string | null;
  isRunning: boolean;
  calendarRunId: string | null;
  addMessage: (msg: Omit<ChatMessageData, "id" | "createdAt">) => void;
  handleWizardSubmit: (answers: WizardAnswers) => Promise<void>;
  handleCalendarApprove: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

interface ChatProviderProps {
  runId: string | null;
  orgId: string;
  children: React.ReactNode;
}

export function ChatProvider({ runId, orgId, children }: ChatProviderProps) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [files, setFiles] = useState<BrandFile[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [calendarRunId, setCalendarRunId] = useState<string | null>(null);

  // Track which runIds we've already connected to so we don't re-subscribe
  const connectedRunIds = useRef<Set<string>>(new Set());
  const connectedCalendarRunIds = useRef<Set<string>>(new Set());

  const addMessage = useCallback(
    (msg: Omit<ChatMessageData, "id" | "createdAt">) => {
      setMessages((prev) => [
        ...prev,
        {
          ...msg,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        } as ChatMessageData,
      ]);
    },
    [],
  );

  const handleStartCalendarWizard = useCallback(
    async (organizationId: string) => {
      try {
        const res = await fetch("/api/agent/calendar/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId }),
        });
        const data = await res.json();
        setCalendarRunId(data.runId);
      } catch (err) {
        console.error("Failed to start calendar wizard:", err);
      }
    },
    [],
  );

  // Brand DNA SSE stream
  useEffect(() => {
    if (!runId || connectedRunIds.current.has(runId)) return;
    connectedRunIds.current.add(runId);

    setIsRunning(true);
    const es = new EventSource(`/api/agent/stream/${runId}`);

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

    es.addEventListener("start_calendar_wizard", (e) => {
      const data = JSON.parse(e.data);
      handleStartCalendarWizard(data.organizationId);
    });

    es.addEventListener("complete", () => {
      setIsRunning(false);
      setStatus(null);
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
  }, [runId, addMessage, handleStartCalendarWizard]);

  // Calendar agent SSE stream
  useEffect(() => {
    if (!calendarRunId || connectedCalendarRunIds.current.has(calendarRunId))
      return;
    connectedCalendarRunIds.current.add(calendarRunId);

    setIsRunning(true);
    const es = new EventSource(
      `/api/agent/calendar/stream/${calendarRunId}`,
    );

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
  }, [calendarRunId, addMessage]);

  const handleWizardSubmit = useCallback(
    async (answers: WizardAnswers) => {
      if (!calendarRunId) return;
      await fetch("/api/agent/calendar/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: calendarRunId,
          organizationId: orgId,
          answers,
        }),
      });
    },
    [calendarRunId, orgId],
  );

  const handleCalendarApprove = useCallback(async () => {
    if (!calendarRunId) return;
    await fetch("/api/agent/calendar/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: calendarRunId,
        organizationId: orgId,
        action: "approve_calendar",
      }),
    });
  }, [calendarRunId, orgId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        files,
        status,
        isRunning,
        calendarRunId,
        addMessage,
        handleWizardSubmit,
        handleCalendarApprove,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
