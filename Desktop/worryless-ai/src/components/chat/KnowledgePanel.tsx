"use client";

import type { BrandFile } from "@/types";

interface KnowledgePanelProps {
  files: BrandFile[];
  logoUrl: string | null;
}

const FILE_LABELS: Record<string, string> = {
  business_profile: "business profile",
  brand_guidelines: "brand guidelines",
  market_research: "market research",
  marketing_strategy: "marketing strategy",
};

export default function KnowledgePanel({ files, logoUrl }: KnowledgePanelProps) {
  return (
    <div className="w-72 border-l border-border bg-white overflow-y-auto">
      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-semibold text-dark uppercase tracking-wider mb-3">Metrics</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-muted uppercase">Active Users</p>
            <p className="text-xs text-muted-dark">Connect GA</p>
          </div>
          <div>
            <p className="text-[10px] text-muted uppercase">Sessions</p>
            <p className="text-xs text-muted-dark">Connect GA</p>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-dark uppercase tracking-wider">Channels</h3>
          <span className="text-[10px] text-muted-dark">Autopilot</span>
        </div>
        <button className="text-xs text-primary hover:underline">+ Add channel</button>
      </div>

      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-semibold text-dark uppercase tracking-wider mb-3">Brand Knowledge Base</h3>
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-light cursor-pointer transition-colors">
              <span className="text-sm">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-dark truncate">{FILE_LABELS[file.type] || file.title}</p>
                <p className="text-[10px] text-muted">
                  {new Date(file.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </p>
              </div>
              <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))}
          {files.length > 2 && (
            <button className="text-xs text-muted-dark hover:text-dark">View all ({files.length}) →</button>
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-xs font-semibold text-dark uppercase tracking-wider mb-3">Brand Assets</h3>
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-light cursor-pointer transition-colors">
          {logoUrl ? (
            <img src={logoUrl} alt="Company Logo" className="w-10 h-10 rounded object-contain bg-light p-1" />
          ) : (
            <div className="w-10 h-10 rounded bg-light flex items-center justify-center text-muted text-xs">Logo</div>
          )}
          <div>
            <p className="text-xs font-medium text-dark">Company Logo</p>
            <p className="text-[10px] text-primary">Click to replace</p>
          </div>
        </div>
      </div>
    </div>
  );
}
