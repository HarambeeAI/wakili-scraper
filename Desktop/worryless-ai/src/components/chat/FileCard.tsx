"use client";

import { useState } from "react";
import type { BrandFile } from "@/types";

interface FileCardProps {
  file: BrandFile;
}

export default function FileCard({ file }: FileCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const displayTitle: Record<string, string> = {
    business_profile: "business-profile.md",
    brand_guidelines: "brand-guidelines.md",
    market_research: "market-research.md",
    marketing_strategy: "marketing-strategy.md",
  };

  async function handleCopy() {
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="my-3 rounded-xl border border-border bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-[#fafafa] border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm">📄</span>
          <span className="text-sm font-medium text-dark">{displayTitle[file.type] || file.title}</span>
          <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">File</span>
          <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Saved</span>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 py-4 max-h-96 overflow-y-auto">
          <div
            className="prose prose-sm max-w-none prose-headings:text-dark prose-p:text-muted-dark prose-strong:text-dark prose-table:text-sm"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(file.content) }}
          />
        </div>
      )}

      <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-muted-dark hover:text-dark transition-colors"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          {isExpanded ? "Collapse" : "Expand"}
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-muted-dark hover:text-dark transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(
      /\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)*)/g,
      (_match: string, header: string, body: string) => {
        const headers = header.split("|").filter(Boolean).map((h: string) => `<th>${h.trim()}</th>`).join("");
        const rows = body
          .trim()
          .split("\n")
          .map((row: string) => {
            const cells = row.split("|").filter(Boolean).map((c: string) => `<td>${c.trim()}</td>`).join("");
            return `<tr>${cells}</tr>`;
          })
          .join("");
        return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
      }
    )
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hultop])(.+)$/gm, "<p>$1</p>");
}
