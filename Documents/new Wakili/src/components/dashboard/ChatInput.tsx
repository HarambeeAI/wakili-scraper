import { useState, useRef, useEffect } from "react";
import WebToggle from "./WebToggle";
import DeepResearchToggle from "./DeepResearchToggle";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  webEnabled?: boolean;
  onToggleWeb?: () => void;
  deepResearch?: boolean;
  onToggleDeep?: () => void;
}

export default function ChatInput({
  onSend,
  disabled,
  webEnabled = false,
  onToggleWeb,
  deepResearch = false,
  onToggleDeep,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  const handleSubmit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="sticky bottom-0 z-10 px-4 md:px-0 pb-6 pt-4 bg-gradient-to-t from-surface via-surface/95 to-transparent">
      <div className="max-w-3xl mx-auto">
        {/* Double-bezel input */}
        <div className="rounded-[1.75rem] bg-overlay-2 ring-1 ring-overlay-8 p-1.5 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] focus-within:ring-accent/30 focus-within:bg-accent/[0.02]">
          <div className="rounded-[calc(1.75rem-0.375rem)] bg-surface-card shadow-[var(--tw-inset-shadow)] flex items-end gap-3 px-5 py-3">
            {/* Web search toggle */}
            {onToggleWeb && (
              <WebToggle enabled={webEnabled} onToggle={onToggleWeb} />
            )}

            {/* Deep research toggle */}
            {onToggleDeep && (
              <DeepResearchToggle
                enabled={deepResearch}
                onToggle={onToggleDeep}
              />
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                deepResearch
                  ? "Ask a complex legal question — deep multi-step analysis..."
                  : "Ask a legal research question..."
              }
              rows={1}
              className="flex-1 bg-transparent text-text-primary text-sm placeholder:text-text-tertiary outline-none resize-none leading-relaxed max-h-[200px] py-1.5"
              disabled={disabled}
            />

            {/* Send */}
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || disabled}
              className="group shrink-0 w-9 h-9 rounded-full bg-accent hover:bg-accent/90 disabled:bg-surface-hover flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.95] mb-0.5"
            >
              {disabled ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px"
                >
                  <path d="M12 19V5" />
                  <path d="m5 12 7-7 7 7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-text-tertiary text-center mt-2.5">
          {deepResearch
            ? "Deep research: multi-step planning, synthesis, and verification."
            : "Lawlyfy AI can make mistakes. Always verify citations against source documents."}
        </p>
      </div>
    </div>
  );
}
