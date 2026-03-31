/**
 * Hook for managing chat state with SSE streaming and DB persistence.
 */

import { useState, useCallback, useRef } from "react";
import {
  streamChat,
  getHistory,
  getCanvas,
  uploadDocuments,
  TOTAL_TOKEN_BUDGET,
  type Citation,
  type StreamEvent,
  type HistoryMessage,
  type DocumentContext,
  type UploadedFile,
} from "../lib/api";
import {
  type SubscriptionBlock,
  EMPTY_BLOCK,
} from "../components/dashboard/SubscriptionGate";

export interface AttachedFileInfo {
  filename: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  attachedFiles?: AttachedFileInfo[];
}

export interface TopicAssessment {
  topic: string;
  confidence: "high" | "medium" | "low";
  note: string;
}

export interface CanvasSection {
  id: string;
  heading: string;
  content: string;
  order: number;
  last_edited_by?: "agent" | "user";
  comment?: string; // Agent suggestion/comment for this section
  confidence?: "high" | "medium" | "low"; // Section completeness score
  enrichment_prompt?: string; // Co-Drafter guidance for improving the section
  topic_assessments?: TopicAssessment[]; // Per-topic confidence within the section
}

export interface CanvasState {
  active: boolean;
  docType: string;
  docTitle: string;
  skillSlug: string;
  sections: CanvasSection[];
  version: number;
  status: "intake" | "researching" | "drafting" | "finalized";
}

let msgIdCounter = 0;
const nextId = () => String(++msgIdCounter);

export interface AttachedDocument {
  file: File;
  filename: string;
  status: "uploading" | "ready" | "error";
  progress: number;
  text: string;
  error: string;
  tokenEstimate: number;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [threadId, setThreadId] = useState("");
  const [webEnabled, setWebEnabled] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [researchPhase, setResearchPhase] = useState("");
  const [attachedDocs, setAttachedDocs] = useState<AttachedDocument[]>([]);
  const [canvas, setCanvas] = useState<CanvasState>({
    active: false,
    docType: "",
    docTitle: "",
    skillSlug: "",
    sections: [],
    version: 0,
    status: "intake",
  });
  const [subscriptionBlock, setSubscriptionBlock] =
    useState<SubscriptionBlock>(EMPTY_BLOCK);
  const abortRef = useRef<AbortController | null>(null);
  const planStepsRef = useRef<string[]>([]);
  const completedStepsRef = useRef<number>(0);

  // Running token total from successfully attached docs
  const usedTokens = attachedDocs
    .filter((d) => d.status === "ready")
    .reduce((sum, d) => sum + d.tokenEstimate, 0);

  const remainingTokens = TOTAL_TOKEN_BUDGET - usedTokens;

  const addAttachments = useCallback(
    async (files: File[]) => {
      const MAX_SIZE = 10 * 1024 * 1024;
      const ALLOWED_EXT = [".pdf", ".docx", ".txt"];

      const validFiles = files.filter((f) => {
        const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
        return ALLOWED_EXT.includes(ext) && f.size <= MAX_SIZE;
      });

      if (validFiles.length === 0) return;

      // Add placeholder entries
      const placeholders: AttachedDocument[] = validFiles.map((f) => ({
        file: f,
        filename: f.name,
        status: "uploading" as const,
        progress: 0,
        text: "",
        error: "",
        tokenEstimate: 0,
      }));

      setAttachedDocs((prev) => [...prev, ...placeholders]);

      // Upload all files, passing current token usage so server can enforce budget
      try {
        const result = await uploadDocuments(
          validFiles,
          usedTokens,
          (percent) => {
            setAttachedDocs((prev) =>
              prev.map((d) =>
                d.status === "uploading" ? { ...d, progress: percent } : d,
              ),
            );
          },
        );

        // Update placeholders with results
        setAttachedDocs((prev) =>
          prev.map((d) => {
            if (d.status !== "uploading") return d;
            const match = result.files.find(
              (r: UploadedFile) => r.filename === d.filename,
            );
            if (!match)
              return { ...d, status: "error" as const, error: "No response" };
            if (match.error) {
              return {
                ...d,
                status: "error" as const,
                error: match.error,
                progress: 100,
                tokenEstimate: match.token_estimate,
              };
            }
            return {
              ...d,
              status: "ready" as const,
              text: match.text,
              progress: 100,
              tokenEstimate: match.token_estimate,
            };
          }),
        );
      } catch (err) {
        setAttachedDocs((prev) =>
          prev.map((d) =>
            d.status === "uploading"
              ? {
                  ...d,
                  status: "error" as const,
                  error: (err as Error).message,
                  progress: 0,
                }
              : d,
          ),
        );
      }
    },
    [usedTokens],
  );

  const removeAttachment = useCallback((filename: string) => {
    setAttachedDocs((prev) => prev.filter((d) => d.filename !== filename));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachedDocs([]);
  }, []);

  const sendMessage = useCallback(
    async (text: string, options?: { forceDeep?: boolean }) => {
      if (!text.trim() || isStreaming) return;
      const useDeep = options?.forceDeep ?? deepResearch;

      // Build conversation history from existing messages (last 10 messages max)
      const historyMessages: HistoryMessage[] = messages
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      // Collect ready document contexts before clearing
      const readyDocs: DocumentContext[] = attachedDocs
        .filter((d) => d.status === "ready" && d.text)
        .map((d) => ({ filename: d.filename, text: d.text }));

      // Add user message (with attachment indicators if present)
      const fileInfos: AttachedFileInfo[] | undefined =
        readyDocs.length > 0
          ? readyDocs.map((d) => ({ filename: d.filename }))
          : undefined;
      const userMsg: Message = {
        id: nextId(),
        role: "user",
        content: text,
        attachedFiles: fileInfos,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setResearchPhase("");
      planStepsRef.current = [];
      completedStepsRef.current = 0;

      // Clear attachments after capturing them
      setAttachedDocs([]);

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
            deep_research: useDeep,
            history: historyMessages.length > 0 ? historyMessages : undefined,
            documents: readyDocs.length > 0 ? readyDocs : undefined,
          },
          (event: StreamEvent) => {
            // Debug: log all non-token events to trace canvas lifecycle
            if (event.type !== "token") {
              console.log("[SSE]", event.type, event);
            }
            if (event.type === "token" && event.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + event.content }
                    : m,
                ),
              );
            } else if (event.type === "plan" && event.steps) {
              // Store steps and render as a checklist
              planStepsRef.current = event.steps;
              completedStepsRef.current = 0;
              const docNote = event.document_requested
                ? `\n> A **${(event.document_format || "pdf").toUpperCase()}** document will be generated.\n`
                : "";
              const checklist =
                event.steps.map((s) => `- [ ] ${s}`).join("\n") +
                docNote +
                `\n\n---\n\n`;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + checklist }
                    : m,
                ),
              );
            } else if (event.type === "step_complete") {
              // Tick off the completed step in the checklist
              completedStepsRef.current += 1;
              const steps = planStepsRef.current;
              const done = completedStepsRef.current;
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  // Rebuild the checklist portion with ticked steps
                  let updated = m.content;
                  for (let i = 0; i < steps.length; i++) {
                    const unchecked = `- [ ] ${steps[i]}`;
                    const checked = `- [x] ${steps[i]}`;
                    if (i < done) {
                      updated = updated.replace(unchecked, checked);
                    }
                  }
                  return { ...m, content: updated };
                }),
              );
            } else if (event.type === "citations" && event.citations) {
              accumulatedCitations.push(...event.citations);
            } else if (event.type === "canvas_init") {
              console.log("[CANVAS] canvas_init received:", event);
              setCanvas({
                active: true,
                docType: event.doc_type || "",
                docTitle: event.doc_title || "Legal Document",
                skillSlug: event.skill_slug || "",
                sections: [],
                version: 0,
                status: "intake",
              });
            } else if (event.type === "canvas_intake") {
              setCanvas((prev) => ({
                ...prev,
                status: "researching",
              }));
            } else if (event.type === "canvas_section") {
              console.log(
                "[CANVAS] canvas_section received:",
                event.section_id,
              );
              setCanvas((prev) => ({
                ...prev,
                status: "drafting",
                sections: [
                  ...prev.sections,
                  {
                    id: event.section_id || "",
                    heading: event.heading || "",
                    content: event.content || "",
                    order: event.order || prev.sections.length,
                    last_edited_by: "agent",
                  },
                ],
              }));
            } else if (event.type === "canvas_update") {
              setCanvas((prev) => ({
                ...prev,
                sections: prev.sections.map((s) =>
                  s.id === event.section_id
                    ? {
                        ...s,
                        content: event.content || s.content,
                        heading: event.heading || s.heading,
                        last_edited_by: "agent" as const,
                      }
                    : s,
                ),
              }));
            } else if (event.type === "canvas_complete") {
              setCanvas((prev) => ({
                ...prev,
                sections: (event.sections as CanvasSection[]) || prev.sections,
                version: event.version || prev.version + 1,
                status: "drafting",
              }));
            } else if (event.type === "canvas_comment") {
              setCanvas((prev) => ({
                ...prev,
                sections: prev.sections.map((s) =>
                  s.id === event.section_id
                    ? { ...s, comment: event.comment || "" }
                    : s,
                ),
              }));
            } else if (event.type === ("canvas_assessment" as any)) {
              const assessEvent = event as any;
              setCanvas((prev) => ({
                ...prev,
                sections: prev.sections.map((s) =>
                  s.id === assessEvent.section_id
                    ? {
                        ...s,
                        confidence: assessEvent.confidence || "medium",
                        enrichment_prompt: assessEvent.enrichment_prompt || "",
                        topic_assessments: assessEvent.topic_assessments || [],
                      }
                    : s,
                ),
              }));
            } else if (event.type === ("trial_limit" as any)) {
              // Trial limit reached — show subscription gate modal
              const limitEvent = event as any;
              setSubscriptionBlock({
                show: true,
                error: "trial_limit_reached",
                type: limitEvent.usage_type === "draft" ? "draft" : "chat",
                message:
                  limitEvent.message || "You've reached your free trial limit.",
                trialChatsRemaining: limitEvent.trial_chats_remaining,
                trialDraftsRemaining: limitEvent.trial_drafts_remaining,
              });
              // Remove the empty assistant placeholder
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            } else if (event.type === ("trial_usage" as any)) {
              // Trial usage update — frontend can read updated counts from auth/me
              // No-op here; TrialBanner reads from auth context which gets refreshed
            } else if (event.type === "status" && event.phase) {
              setResearchPhase(event.message || event.phase);
            } else if (event.type === "done") {
              if (event.thread_id) setThreadId(event.thread_id);
              setResearchPhase("");
              // Also collect citations from the done event (belt-and-suspenders)
              if (event.citations && Array.isArray(event.citations)) {
                for (const c of event.citations) {
                  if (
                    !accumulatedCitations.some((ac: Citation) => ac.id === c.id)
                  ) {
                    accumulatedCitations.push(c);
                  }
                }
              }
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
        if ((err as Error).name === "AbortError") {
          // User cancelled — do nothing
        } else if ((err as Error).message === "subscription_blocked") {
          // HTTP 402 — subscription or trial block
          const detail =
            (err as Error & { detail?: Record<string, unknown> }).detail || {};
          setSubscriptionBlock({
            show: true,
            error:
              (detail.error as SubscriptionBlock["error"]) ||
              "subscription_inactive",
            type: (detail.type as "chat" | "draft") || undefined,
            message:
              (detail.message as string) ||
              "Your subscription is inactive. Please subscribe to continue.",
            trialChatsRemaining: detail.trial_chats_remaining as
              | number
              | undefined,
            trialDraftsRemaining: detail.trial_drafts_remaining as
              | number
              | undefined,
          });
          // Remove the empty assistant placeholder
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        } else {
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
        setResearchPhase("");
        abortRef.current = null;
      }
    },
    [isStreaming, threadId, webEnabled, deepResearch, attachedDocs],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setResearchPhase("");
  }, []);

  const updateCanvasSection = useCallback(
    (sectionId: string, content: string) => {
      setCanvas((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? { ...s, content, last_edited_by: "user" as const }
            : s,
        ),
        version: prev.version + 1,
      }));
    },
    [],
  );

  const closeCanvas = useCallback(() => {
    setCanvas((prev) => ({ ...prev, active: false }));
  }, []);

  const reopenCanvas = useCallback(() => {
    setCanvas((prev) =>
      prev.sections.length > 0 ? { ...prev, active: true } : prev,
    );
  }, []);

  const newThread = useCallback(() => {
    setMessages([]);
    setThreadId("");
    setResearchPhase("");
    setAttachedDocs([]);
    setCanvas({
      active: false,
      docType: "",
      docTitle: "",
      skillSlug: "",
      sections: [],
      version: 0,
      status: "intake",
    });
    msgIdCounter = 0;
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try {
      const data = await getHistory(id);
      setThreadId(id);
      msgIdCounter = 0;

      const loaded: Message[] = (data.messages || []).map(
        (m: {
          id?: string;
          role: string;
          content: string;
          citations?: Citation[];
          attached_files?: { filename: string }[];
        }) => ({
          id: m.id || nextId(),
          role: m.role as "user" | "assistant",
          content: m.content,
          citations: m.citations || [],
          attachedFiles: m.attached_files,
        }),
      );

      setMessages(loaded);

      // Restore canvas state if this thread has a draft
      try {
        const canvasData = await getCanvas(id);
        if (canvasData && canvasData.sections?.length > 0) {
          setCanvas({
            active: false, // Don't auto-open — show the draft card instead
            docType: canvasData.doc_type || "",
            docTitle: canvasData.title || "Legal Document",
            skillSlug: canvasData.skill_slug || "",
            sections: (canvasData.sections || []).map(
              (s: {
                id: string;
                heading: string;
                content: string;
                order: number;
                last_edited_by?: string;
                confidence?: string;
                enrichment_prompt?: string;
                topic_assessments?: {
                  topic: string;
                  confidence: string;
                  note: string;
                }[];
                comment?: string;
              }) => ({
                id: s.id,
                heading: s.heading,
                content: s.content,
                order: s.order,
                last_edited_by: s.last_edited_by || "agent",
                confidence: s.confidence as
                  | "high"
                  | "medium"
                  | "low"
                  | undefined,
                enrichment_prompt: s.enrichment_prompt,
                topic_assessments: s.topic_assessments || [],
                comment: s.comment,
              }),
            ),
            version: canvasData.version || 1,
            status: canvasData.status || "drafting",
          });
        } else {
          setCanvas({
            active: false,
            docType: "",
            docTitle: "",
            skillSlug: "",
            sections: [],
            version: 0,
            status: "intake",
          });
        }
      } catch {
        // No canvas for this thread — reset
        setCanvas({
          active: false,
          docType: "",
          docTitle: "",
          skillSlug: "",
          sections: [],
          version: 0,
          status: "intake",
        });
      }
    } catch (err) {
      console.error("Failed to load thread:", err);
    }
  }, []);

  const toggleWeb = useCallback(() => {
    setWebEnabled((prev) => !prev);
  }, []);

  const toggleDeep = useCallback(() => {
    setDeepResearch((prev) => !prev);
  }, []);

  return {
    messages,
    isStreaming,
    threadId,
    webEnabled,
    deepResearch,
    researchPhase,
    attachedDocs,
    usedTokens,
    remainingTokens,
    totalTokenBudget: TOTAL_TOKEN_BUDGET,
    canvas,
    updateCanvasSection,
    closeCanvas,
    reopenCanvas,
    sendMessage,
    stopStreaming,
    newThread,
    loadThread,
    toggleWeb,
    toggleDeep,
    addAttachments,
    removeAttachment,
    clearAttachments,
    setWebEnabled,
    setDeepResearch,
    subscriptionBlock,
    dismissSubscriptionBlock: useCallback(
      () => setSubscriptionBlock(EMPTY_BLOCK),
      [],
    ),
  };
}
