import { useRef, useEffect, useState, useCallback } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import ChatInput from "../components/dashboard/ChatInput";
import ChatMessage from "../components/dashboard/ChatMessage";
import DocumentViewer from "../components/dashboard/DocumentViewer";
import ExportMenu from "../components/dashboard/ExportMenu";
import ThemeToggle from "../components/shared/ThemeToggle";
import { useThemeContext } from "../hooks/ThemeContext";
import { useChat } from "../hooks/useChat";
import type { Citation } from "../components/dashboard/CitationCard";

const suggestedQueries = [
  "How has the Court of Appeal interpreted Section 17 of the Employment Act on unfair dismissal in the last 5 years?",
  "Compare the legal tests for negligence in Donoghue v Stevenson and how Kenyan courts have applied them",
  "What are the grounds for setting aside an arbitral award under the Arbitration Act, 1995, and which cases have succeeded?",
  "Trace the legislative history of land ownership rights for non-citizens from the 2010 Constitution onwards",
];

export default function DashboardPage() {
  const { theme, toggle } = useThemeContext();
  const {
    messages,
    isStreaming,
    threadId,
    webEnabled,
    deepResearch,
    researchPhase,
    sendMessage,
    newThread,
    loadThread,
    toggleWeb,
    toggleDeep,
  } = useChat();

  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(
    null,
  );
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

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-[100dvh] bg-surface">
      <Sidebar
        activeThreadId={threadId}
        onSelectThread={handleSelectThread}
        onNewThread={handleNewThread}
        refreshKey={refreshKey}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 md:px-10 py-4 bg-surface/80 backdrop-blur-2xl border-b border-overlay-6 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium text-text-primary">
              Research Chat
            </h1>
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
          </div>
          <div className="flex items-center gap-2">
            {/* Export */}
            <ExportMenu
              threadId={threadId}
              disabled={!hasMessages || isStreaming}
            />

            {/* New chat */}
            <button
              onClick={handleNewThread}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-text-secondary ring-1 ring-overlay-8 hover:bg-overlay-4 hover:ring-overlay-12 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
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
              New Thread
            </button>
            <ThemeToggle theme={theme} onToggle={toggle} />
          </div>
        </header>

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            /* Empty state — welcome screen */
            <div className="flex flex-col items-center justify-center min-h-full px-4 py-16">
              <div className="text-center mb-12">
                {/* Logo mark */}
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent/60 mb-6 shadow-[0_0_40px_rgba(124,92,252,0.2)]">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <path d="M8 10h8" />
                    <path d="M8 14h4" />
                  </svg>
                </div>
                <h2 className="font-serif text-3xl md:text-4xl text-text-primary tracking-tight mb-3">
                  How can I help with your{" "}
                  <span className="italic text-accent">research</span>?
                </h2>
                <p className="text-text-secondary text-sm max-w-md mx-auto">
                  Ask any legal question. I'll analyze case law, statutes, and
                  regulations — with verifiable citations you can click to view
                  the source.
                </p>
              </div>

              {/* Suggested queries */}
              <div className="w-full max-w-2xl">
                <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-text-tertiary block mb-4 text-center">
                  Try asking
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {suggestedQueries.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
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
                        <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors duration-500">
                          {q}
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
                  onCitationClick={setSelectedCitation}
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

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming}
          webEnabled={webEnabled}
          onToggleWeb={toggleWeb}
          deepResearch={deepResearch}
          onToggleDeep={toggleDeep}
        />
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
}
