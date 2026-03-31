import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useRef, useState } from "react";
import type { CanvasSection } from "../../hooks/useChat";

/**
 * Convert plain text content to simple HTML for TipTap.
 * Splits on double-newlines into <p> tags, preserves single newlines as <br>.
 * Handles numbered/lettered list items and semicolon-separated clauses.
 */
function textToHtml(text: string): string {
  if (!text) return "<p></p>";

  // If content already contains HTML tags, return as-is
  if (/<[a-z][\s\S]*>/i.test(text)) return text;

  // Split into paragraphs on double newline
  const paragraphs = text.split(/\n\s*\n/);

  return paragraphs
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";

      // Convert single newlines within a paragraph to <br>
      const withBreaks = trimmed
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("<br>");

      return `<p>${withBreaks}</p>`;
    })
    .filter(Boolean)
    .join("");
}

/** Border + icon color classes by confidence level */
const CONFIDENCE_STYLES = {
  high: {
    border: "border-l-emerald-400",
    bg: "bg-emerald-50/60",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    label: "Complete",
    labelColor: "text-emerald-700",
  },
  medium: {
    border: "border-l-amber-400",
    bg: "bg-amber-50/50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    label: "Needs Review",
    labelColor: "text-amber-700",
  },
  low: {
    border: "border-l-red-400",
    bg: "bg-red-50/50",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    label: "Requires Input",
    labelColor: "text-red-700",
  },
} as const;

function ConfidenceIcon({ level }: { level: "high" | "medium" | "low" }) {
  const style = CONFIDENCE_STYLES[level];
  if (level === "high") {
    return (
      <div
        className={`flex items-center justify-center w-5 h-5 rounded-full ${style.iconBg}`}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={style.iconColor}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (level === "medium") {
    return (
      <div
        className={`flex items-center justify-center w-5 h-5 rounded-full ${style.iconBg}`}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={style.iconColor}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
    );
  }
  // low
  return (
    <div
      className={`flex items-center justify-center w-5 h-5 rounded-full ${style.iconBg}`}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={style.iconColor}
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </div>
  );
}

interface CanvasEditorProps {
  sections: CanvasSection[];
  onSectionEdit: (sectionId: string, content: string) => void;
  isStreaming: boolean;
  onEnrichmentClick?: (prompt: string) => void;
}

export default function CanvasEditor({
  sections,
  onSectionEdit,
  isStreaming,
  onEnrichmentClick,
}: CanvasEditorProps) {
  const [lockedSectionId, setLockedSectionId] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      {sections.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          onEdit={onSectionEdit}
          isStreaming={isStreaming}
          isLocked={lockedSectionId === section.id}
          onFocus={() => setLockedSectionId(section.id)}
          onBlur={() => {
            setTimeout(() => {
              setLockedSectionId((prev) => (prev === section.id ? null : prev));
            }, 500);
          }}
          onEnrichmentClick={onEnrichmentClick}
        />
      ))}
      {sections.length === 0 && (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm italic">
          Document sections will appear here as they are generated...
        </div>
      )}
    </div>
  );
}

interface SectionBlockProps {
  section: CanvasSection;
  onEdit: (sectionId: string, content: string) => void;
  isStreaming: boolean;
  isLocked: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onEnrichmentClick?: (prompt: string) => void;
}

function SectionBlock({
  section,
  onEdit,
  isStreaming,
  isLocked,
  onFocus,
  onBlur,
  onEnrichmentClick,
}: SectionBlockProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastContentRef = useRef(section.content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3, 4] },
      }),
      Placeholder.configure({
        placeholder: "Start typing...",
      }),
      Highlight,
    ],
    content: textToHtml(section.content),
    editable: !isStreaming,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (text !== lastContentRef.current) {
          lastContentRef.current = text;
          onEdit(section.id, text);
        }
      }, 1500);
    },
    onFocus: () => onFocus(),
    onBlur: () => onBlur(),
  });

  // Update editor content when agent modifies the section
  // Skip if the user has this section locked
  useEffect(() => {
    if (editor && section.content !== lastContentRef.current) {
      if (section.last_edited_by === "agent" && !isLocked) {
        lastContentRef.current = section.content;
        editor.commands.setContent(textToHtml(section.content));
      }
    }
  }, [editor, section.content, section.last_edited_by, isLocked]);

  // Toggle editable based on streaming state
  useEffect(() => {
    if (editor) {
      editor.setEditable(!isStreaming);
    }
  }, [editor, isStreaming]);

  const confidence = section.confidence;
  const hasConfidence = confidence && confidence in CONFIDENCE_STYLES;
  const style = hasConfidence
    ? CONFIDENCE_STYLES[confidence as keyof typeof CONFIDENCE_STYLES]
    : null;

  // Extract the user-facing question from enrichment prompt (strip "Co-Drafter:" prefix for chat)
  const enrichmentText = section.enrichment_prompt || "";
  const isEnrichmentActionable =
    enrichmentText && confidence !== "high" && !isStreaming;

  return (
    <div
      className={`group relative mb-6 last:mb-0 rounded-sm transition-all duration-200 ${
        hasConfidence ? `border-l-[3px] ${style!.border} pl-4 -ml-1` : ""
      } ${
        isLocked
          ? "bg-blue-50/60 ring-1 ring-blue-200/60 -mx-3 px-3 py-2"
          : "hover:bg-gray-50/50 -mx-2 px-2 py-1"
      } ${
        section.last_edited_by === "agent" && isStreaming
          ? "bg-amber-50/40"
          : ""
      }`}
    >
      {/* Section heading — document-style */}
      <div className="flex items-center gap-2 mb-3">
        {hasConfidence && <ConfidenceIcon level={confidence!} />}
        <h3
          className="text-[14px] font-bold text-gray-900 tracking-wide uppercase flex-1"
          style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
        >
          {section.heading}
        </h3>
        {hasConfidence && (
          <span
            className={`text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${style!.iconBg} ${style!.labelColor}`}
          >
            {style!.label}
          </span>
        )}
        {isLocked && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium normal-case tracking-normal">
            editing
          </span>
        )}
      </div>

      {/* Co-Drafter enrichment prompt — below heading, above content */}
      {enrichmentText && confidence !== "high" && (
        <div
          className={`mb-3 w-full text-left px-3.5 py-3 rounded-lg transition-all duration-200 ${
            confidence === "low"
              ? "bg-red-50 border border-red-200/60"
              : "bg-amber-50 border border-amber-200/60"
          }`}
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0">
              {confidence === "low" ? (
                <ConfidenceIcon level="low" />
              ) : (
                <ConfidenceIcon level="medium" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-[12px] leading-relaxed whitespace-pre-line ${
                  confidence === "low" ? "text-red-800" : "text-amber-800"
                }`}
              >
                <span className="font-bold">Co-Drafter:</span>{" "}
                {enrichmentText.replace(/^Co-Drafter:\s*/i, "")}
              </p>

              {/* Topic assessment pills */}
              {section.topic_assessments &&
                section.topic_assessments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {section.topic_assessments.map((ta, idx) => {
                      const pillColors =
                        ta.confidence === "high"
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-150 hover:border-emerald-300"
                          : ta.confidence === "low"
                            ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-150 hover:border-red-300"
                            : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-150 hover:border-amber-300";
                      const pillIcon =
                        ta.confidence === "high"
                          ? "\u2713"
                          : ta.confidence === "low"
                            ? "\u2717"
                            : "\u26A0";

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onEnrichmentClick) {
                              onEnrichmentClick(
                                `[${section.heading}] ${ta.topic} \u2014 ${ta.note}`,
                              );
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all duration-150 cursor-pointer hover:shadow-sm ${pillColors}`}
                          title={ta.note}
                        >
                          <span className="text-[9px]">{pillIcon}</span>
                          {ta.topic}
                        </button>
                      );
                    })}
                  </div>
                )}

              {isEnrichmentActionable && (
                <button
                  type="button"
                  onClick={() => {
                    if (onEnrichmentClick) {
                      const question = enrichmentText
                        .replace(/^Co-Drafter:\s*/i, "")
                        .trim();
                      onEnrichmentClick(question);
                    }
                  }}
                  className={`mt-2 text-[10px] font-medium uppercase tracking-wider ${
                    confidence === "low"
                      ? "text-red-500 hover:text-red-600"
                      : "text-amber-500 hover:text-amber-600"
                  } transition-colors`}
                >
                  Click to respond in chat
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* High confidence — subtle green confirmation below heading */}
      {enrichmentText && confidence === "high" && (
        <div className="mb-3 px-3 py-2 rounded-md bg-emerald-50/60 border border-emerald-100">
          <p className="text-[11px] text-emerald-700 leading-relaxed">
            <span className="font-bold">Co-Drafter:</span>{" "}
            {enrichmentText.replace(/^Co-Drafter:\s*/i, "")}
          </p>
        </div>
      )}

      {/* Editor — document typography */}
      <div
        className="legal-doc-editor"
        style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Agent suggestion comment (from review node — kept separate from enrichment) */}
      {section.comment && (
        <div className="mt-3 ml-4 px-3 py-2.5 rounded-md bg-amber-50 border-l-2 border-amber-300 text-[12px] text-amber-800 leading-relaxed">
          <div className="flex items-center gap-1.5 mb-1">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-amber-500"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="font-semibold text-[10px] uppercase tracking-wider text-amber-600">
              AI Suggestion
            </span>
          </div>
          {section.comment}
        </div>
      )}

      {/* Edit indicator — top right on hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] uppercase tracking-wider text-gray-300">
          {section.last_edited_by === "user" ? "edited" : ""}
        </span>
      </div>
    </div>
  );
}
