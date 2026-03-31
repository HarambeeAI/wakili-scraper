import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import ChatInput from "../components/dashboard/ChatInput";
import ChatMessage from "../components/dashboard/ChatMessage";
import type { DocEntry } from "../components/dashboard/ChatMessage";
import DocumentViewer from "../components/dashboard/DocumentViewer";
import type { ExportDocument } from "../components/dashboard/DocumentViewer";
import Canvas from "../components/canvas/Canvas";
import ThemeToggle from "../components/shared/ThemeToggle";
import TrialBanner from "../components/dashboard/TrialBanner";
import UpgradeNudge from "../components/dashboard/UpgradeNudge";
import SubscriptionGate from "../components/dashboard/SubscriptionGate";
import TeamPanel from "../components/dashboard/TeamPanel";
import SubscriptionPanel from "../components/dashboard/SubscriptionPanel";
import { useThemeContext } from "../hooks/ThemeContext";
import { useChat } from "../hooks/useChat";
import { useAuth } from "../hooks/useAuth";
import type { Citation } from "../components/dashboard/CitationCard";
import { computeCompleteness } from "../lib/canvasCompleteness";

const suggestedQueries = [
  {
    text: "I'm representing a tenant in a commercial lease dispute. The landlord locked them out without a court order after 2 months of arrears. What remedies does my client have under the Landlord and Tenant Act, and is there precedent for damages for illegal re-entry?",
    deep: false,
  },
  {
    text: "Draft a mutual NDA for a Kenyan fintech company offering crypto wallet services, accounting for the Virtual Asset Service Providers Act 2025, CBK prudential guidelines on digital assets, and Data Protection Act requirements for cross-border data sharing.",
    deep: true,
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { theme, toggle } = useThemeContext();

  const {
    messages,
    isStreaming,
    threadId,
    webEnabled,
    deepResearch,
    researchPhase,
    attachedDocs,
    usedTokens,
    remainingTokens,
    totalTokenBudget,
    sendMessage,
    newThread,
    loadThread,
    toggleWeb,
    toggleDeep,
    addAttachments,
    removeAttachment,
    canvas,
    updateCanvasSection,
    closeCanvas,
    reopenCanvas,
    subscriptionBlock,
    dismissSubscriptionBlock,
  } = useChat();

  const hasMessages = messages.length > 0;

  // Typewriter cycling animation
  const rotatingWords = useMemo(
    () => [
      "research",
      "draft",
      "analyse",
      "strategise",
      "review",
      "negotiate",
      "comply",
      "advise",
      "mediate",
    ],
    [],
  );
  const [wordIndex, setWordIndex] = useState(0);
  const [displayed, setDisplayed] = useState(rotatingWords[0]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Only run typewriter when no messages (empty state visible)
    if (hasMessages) return;

    const word = rotatingWords[wordIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting) {
      // Typing
      if (displayed.length < word.length) {
        timeout = setTimeout(
          () => setDisplayed(word.slice(0, displayed.length + 1)),
          100,
        );
      } else {
        // Pause before deleting
        timeout = setTimeout(() => setIsDeleting(true), 2000);
      }
    } else {
      // Deleting
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 60);
      } else {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % rotatingWords.length);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayed, isDeleting, wordIndex, rotatingWords, hasMessages]);

  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(
    null,
  );
  const [selectedExportDoc, setSelectedExportDoc] =
    useState<ExportDocument | null>(null);

  const handleDocumentView = useCallback((doc: DocEntry) => {
    setSelectedExportDoc({ url: doc.url, filename: doc.filename });
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  // Refresh sidebar threads when streaming ends (new message saved)
  useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      setRefreshKey((k) => k + 1);
    }
  }, [isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewThread = useCallback(() => {
    newThread();
  }, [newThread]);

  const handleSelectThread = useCallback(
    (id: string) => {
      if (id !== threadId) {
        loadThread(id);
      }
    },
    [threadId, loadThread],
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Sub-views: "chat" (default) | "team" | "subscription"
  const [activeView, setActiveView] = useState<
    "chat" | "team" | "subscription"
  >("chat");
  // Mobile canvas tab: "chat" | "document"
  const [mobileTab, setMobileTab] = useState<"chat" | "document">("chat");
  // Enrichment prefill for chat input
  const [enrichmentPrefill, setEnrichmentPrefill] = useState("");

  // Auto-switch to document tab on mobile when canvas sections arrive
  useEffect(() => {
    if (canvas.active && canvas.sections.length > 0) {
      setMobileTab("document");
    }
  }, [canvas.active, canvas.sections.length]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-surface">
      <Sidebar
        activeThreadId={threadId}
        onSelectThread={(id) => {
          setActiveView("chat");
          handleSelectThread(id);
        }}
        onNewThread={() => {
          setActiveView("chat");
          handleNewThread();
        }}
        refreshKey={refreshKey}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        onNavigate={(view) => setActiveView(view as "team" | "subscription")}
        forceCollapsed={canvas.active}
      />

      {/* Team / Subscription sub-views */}
      {activeView === "team" && (
        <TeamPanel onBack={() => setActiveView("chat")} />
      )}
      {activeView === "subscription" && (
        <SubscriptionPanel onBack={() => setActiveView("chat")} />
      )}

      {activeView === "chat" && (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Trial banner — always full width above chat+canvas */}
          <TrialBanner />

          <div
            className={`flex-1 flex min-w-0 min-h-0 ${canvas.active ? "md:flex-row flex-col" : "flex-col"}`}
          >
            {/* Mobile tab bar — only shown when canvas is active on mobile */}
            {canvas.active && (
              <div className="md:hidden flex border-b border-overlay-6 bg-surface-elevated shrink-0">
                <button
                  onClick={() => setMobileTab("chat")}
                  className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${
                    mobileTab === "chat"
                      ? "text-accent border-b-2 border-accent"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setMobileTab("document")}
                  className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${
                    mobileTab === "document"
                      ? "text-accent border-b-2 border-accent"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  Document
                  {canvas.sections.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-accent/10 text-accent">
                      {canvas.sections.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Chat panel: on mobile with canvas, hidden when document tab is active */}
            <div
              className={`flex flex-col min-w-0 min-h-0 transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                canvas.active
                  ? `md:w-[40%] md:min-w-[320px] md:border-r md:border-overlay-6 ${mobileTab === "chat" ? "flex-1" : "hidden md:flex"}`
                  : "flex-1"
              }`}
            >
              {/* Top bar */}
              <header className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-6 py-4 bg-surface/90 backdrop-blur-md border-b border-overlay-6 shrink-0">
                <div className="flex items-center gap-3">
                  {/* Mobile sidebar toggle */}
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-overlay-4 transition-colors text-text-tertiary"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  </button>
                  {!canvas.active && (
                    <>
                      <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success ring-1 ring-success/20">
                        AI Online
                      </span>
                      {webEnabled && (
                        <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning ring-1 ring-warning/20">
                          Web Enabled
                        </span>
                      )}
                      {deepResearch && (
                        <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gold/10 text-gold ring-1 ring-gold/20">
                          Deep Research
                        </span>
                      )}
                    </>
                  )}
                  {canvas.active && (
                    <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent ring-1 ring-accent/20">
                      Drafting Mode
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* New chat */}
                  <button
                    onClick={handleNewThread}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-accent/10 text-accent ring-1 ring-accent/25 hover:bg-accent/20 hover:ring-accent/40 hover:shadow-[0_0_12px_rgba(124,92,252,0.15)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                    New Task
                  </button>
                  <ThemeToggle theme={theme} onToggle={toggle} />
                </div>
              </header>

              {/* Chat area */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto">
                {!hasMessages ? (
                  /* Empty state — welcome screen */
                  <div className="flex flex-col items-center justify-center min-h-full px-4 py-16">
                    <div className="text-center mb-4">
                      <h2 className="font-serif text-3xl md:text-4xl text-text-primary tracking-tight mb-1">
                        {(() => {
                          const hour = new Date(
                            Date.now() +
                              (3 - -(new Date().getTimezoneOffset() / 60)) *
                                3600000,
                          ).getHours();
                          if (hour < 12) return "Good morning";
                          if (hour < 17) return "Good afternoon";
                          return "Good evening";
                        })()}
                        , {user?.name?.split(" ")[0] || "Counsellor"}
                      </h2>
                      <h3 className="font-serif text-2xl md:text-3xl text-text-secondary tracking-tight mb-4">
                        How can I help you{" "}
                        <span className="italic text-accent">{displayed}</span>
                        <span className="inline-block w-[2px] h-[1em] bg-accent align-middle ml-0.5 animate-pulse" />
                        ?
                      </h3>
                    </div>

                    {/* Suggested queries */}
                    <div className="w-full max-w-2xl">
                      <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-text-tertiary block mb-4 text-center">
                        Try asking
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {suggestedQueries.map((q) => (
                          <button
                            key={q.text}
                            onClick={() => {
                              if (q.deep && !deepResearch) toggleDeep();
                              sendMessage(
                                q.text,
                                q.deep ? { forceDeep: true } : undefined,
                              );
                            }}
                            className="group text-left px-5 py-3.5 rounded-xl ring-1 ring-overlay-6 hover:ring-overlay-12 bg-overlay-2 hover:bg-overlay-4 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                          >
                            <div className="flex items-center gap-3">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-text-tertiary shrink-0 group-hover:text-accent transition-colors duration-500"
                              >
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                              </svg>
                              <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors duration-500">
                                {q.text}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Message thread */
                  <div className="max-w-4xl mx-auto px-4 md:px-10 py-8">
                    {messages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        role={msg.role}
                        content={msg.content}
                        citations={msg.citations}
                        attachedFiles={msg.attachedFiles}
                        onCitationClick={(c: Citation) => {
                          if (c.type === "web" && c.metadata?.url) {
                            window.open(
                              c.metadata.url as string,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          } else {
                            setSelectedCitation(c);
                          }
                        }}
                        onDocumentView={handleDocumentView}
                        isStreaming={
                          isStreaming &&
                          msg.role === "assistant" &&
                          msg === messages[messages.length - 1] &&
                          !msg.citations?.length
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Deep research phase indicator */}
              {isStreaming && researchPhase && (
                <div className="flex items-center justify-center gap-2 py-2 bg-gold/5 border-t border-gold/10">
                  <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                  <span className="text-xs text-gold font-medium">
                    {researchPhase}
                  </span>
                </div>
              )}

              {/* Draft card — shown when canvas is closed but draft data exists */}
              {!canvas.active &&
                canvas.sections.length > 0 &&
                (() => {
                  const comp = computeCompleteness(canvas.sections);
                  const score =
                    comp?.score ??
                    (canvas.status === "finalized"
                      ? 100
                      : canvas.status === "drafting"
                        ? 75
                        : 40);
                  const sectionCount = canvas.sections.length;
                  const docName = canvas.docTitle || "Legal Document";
                  return (
                    <div className="px-4 md:px-10 pb-2 max-w-4xl mx-auto w-full shrink-0">
                      <button
                        onClick={() => {
                          reopenCanvas();
                          setMobileTab("document");
                        }}
                        className="group w-full max-w-md rounded-xl ring-1 ring-accent/15 bg-accent/[0.04] hover:ring-accent/25 hover:bg-accent/[0.07] transition-all duration-300 px-4 py-3 text-left"
                      >
                        {/* Row: icon + text + CTA */}
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent/10 ring-1 ring-accent/20 flex items-center justify-center shrink-0">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-accent"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-text-primary leading-snug truncate">
                              <span className="text-accent">Co-Drafter:</span>{" "}
                              Your {docName} is ready for review
                            </p>
                            <p className="text-[10px] text-text-secondary mt-0.5 leading-relaxed">
                              {sectionCount} section
                              {sectionCount !== 1 ? "s" : ""} drafted
                              {comp ? ` \u00B7 ${score}% complete` : ""} — ready
                              to pick up where we left off?
                            </p>
                          </div>

                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent bg-accent/10 px-2.5 py-1 rounded-full shrink-0 group-hover:bg-accent/20 transition-colors duration-300">
                            Open
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M5 12h14" />
                              <path d="m12 5 7 7-7 7" />
                            </svg>
                          </span>
                        </div>

                        {/* Progress bar — matches canvas completeness */}
                        <div className="mt-2.5">
                          <div className="h-1 rounded-full bg-accent/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                score >= 80
                                  ? "bg-emerald-400/60"
                                  : score >= 50
                                    ? "bg-accent/40"
                                    : "bg-amber-400/50"
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })()}

              {/* Input */}
              <ChatInput
                onSend={sendMessage}
                disabled={isStreaming}
                webEnabled={webEnabled}
                onToggleWeb={toggleWeb}
                deepResearch={deepResearch}
                onToggleDeep={toggleDeep}
                attachedDocs={attachedDocs}
                usedTokens={usedTokens}
                remainingTokens={remainingTokens}
                totalTokenBudget={totalTokenBudget}
                onAddAttachments={addAttachments}
                onRemoveAttachment={removeAttachment}
                prefillText={enrichmentPrefill}
                onPrefillConsumed={() => setEnrichmentPrefill("")}
              />
            </div>
            {/* end chat panel */}

            {/* Canvas panel — right side on desktop, tab-controlled on mobile */}
            {canvas.active && (
              <div
                className={`min-w-0 h-full transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] animate-[slideInRight_400ms_cubic-bezier(0.32,0.72,0,1)] ${
                  mobileTab === "document"
                    ? "flex-1"
                    : "hidden md:flex md:flex-1"
                }`}
              >
                <Canvas
                  canvas={canvas}
                  threadId={threadId}
                  isStreaming={isStreaming}
                  onSectionEdit={updateCanvasSection}
                  onClose={() => {
                    setMobileTab("chat");
                    closeCanvas();
                  }}
                  onEnrichmentClick={(prompt) => {
                    setEnrichmentPrefill(prompt);
                    setMobileTab("chat");
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
      {/* end split container */}

      {/* Document Viewer Modal */}
      <DocumentViewer
        citation={selectedCitation}
        exportDoc={selectedExportDoc}
        onClose={() => {
          setSelectedCitation(null);
          setSelectedExportDoc(null);
        }}
      />

      {/* Upgrade nudge popup for trial users */}
      <UpgradeNudge messageCount={messages.length} />

      {/* Subscription gate modal — trial exhausted / subscription inactive / payment pending */}
      <SubscriptionGate
        block={subscriptionBlock}
        onClose={dismissSubscriptionBlock}
      />
    </div>
  );
}
