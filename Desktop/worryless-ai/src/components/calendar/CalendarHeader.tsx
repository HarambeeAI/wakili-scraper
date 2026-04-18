"use client";

import type { SocialPlatform } from "@/types/calendar";

type ViewMode = "month" | "week" | "day";

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigate: (direction: "prev" | "next" | "today") => void;
  platformFilter: SocialPlatform | null;
  onPlatformFilterChange: (platform: SocialPlatform | null) => void;
  platforms: SocialPlatform[];
}

const PLATFORM_ICONS: Record<string, { bg: string; label: string }> = {
  instagram: { bg: "bg-gradient-to-br from-pink-500 to-purple-600", label: "IG" },
  tiktok: { bg: "bg-black", label: "TT" },
  linkedin: { bg: "bg-blue-600", label: "in" },
  facebook: { bg: "bg-blue-500", label: "fb" },
  x: { bg: "bg-gray-800", label: "X" },
  youtube: { bg: "bg-red-600", label: "YT" },
};

export default function CalendarHeader({ currentDate, viewMode, onViewModeChange, onNavigate, platformFilter, onPlatformFilterChange, platforms }: CalendarHeaderProps) {
  const monthYear = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-dark">{monthYear}</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => onNavigate("prev")} className="w-7 h-7 rounded-md hover:bg-light flex items-center justify-center text-muted-dark transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <button onClick={() => onNavigate("today")} className="px-2.5 py-1 text-xs text-muted-dark hover:text-dark hover:bg-light rounded-md transition-colors">Today</button>
          <button onClick={() => onNavigate("next")} className="w-7 h-7 rounded-md hover:bg-light flex items-center justify-center text-muted-dark transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onPlatformFilterChange(null)} className={`px-2.5 py-1.5 text-[11px] rounded-md transition-all ${!platformFilter ? "bg-primary text-white font-medium" : "text-muted-dark hover:bg-light"}`}>All</button>
        {platforms.map((p) => {
          const icon = PLATFORM_ICONS[p];
          return (
            <button key={p} onClick={() => onPlatformFilterChange(p === platformFilter ? null : p)} className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-md transition-all ${platformFilter === p ? "bg-primary text-white font-medium" : "text-muted-dark hover:bg-light"}`}>
              {icon && <div className={`w-4 h-4 rounded-sm flex items-center justify-center ${platformFilter === p ? "bg-white/20" : icon.bg}`}><span className="text-[6px] font-bold text-white">{icon.label}</span></div>}
              <span className="capitalize">{p}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1 bg-light rounded-lg p-0.5">
        {(["month", "week", "day"] as ViewMode[]).map((mode) => (
          <button key={mode} onClick={() => onViewModeChange(mode)} className={`px-3 py-1.5 text-xs rounded-md transition-all capitalize ${viewMode === mode ? "bg-white text-dark font-medium shadow-sm" : "text-muted-dark hover:text-dark"}`}>{mode}</button>
        ))}
      </div>
    </div>
  );
}
