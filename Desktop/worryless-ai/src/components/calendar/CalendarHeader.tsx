"use client";

type ViewMode = "month" | "week";

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigate: (direction: "prev" | "next" | "today") => void;
  weekStart?: Date;
  weekEnd?: Date;
}

export default function CalendarHeader({ currentDate, viewMode, onViewModeChange, onNavigate, weekStart, weekEnd }: CalendarHeaderProps) {
  const dateLabel = viewMode === "week" && weekStart && weekEnd
    ? `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate("prev")} className="w-8 h-8 rounded-lg hover:bg-light flex items-center justify-center text-muted-dark transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <span className="text-sm font-medium text-dark min-w-[180px] text-center">{dateLabel}</span>
        <button onClick={() => onNavigate("next")} className="w-8 h-8 rounded-lg hover:bg-light flex items-center justify-center text-muted-dark transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </button>
      </div>
      <div className="flex items-center gap-1 bg-light rounded-lg p-0.5">
        <button onClick={() => onNavigate("today")} className="px-3 py-1.5 text-xs text-muted-dark hover:text-dark hover:bg-white rounded-md transition-colors">Today</button>
        <div className="w-px h-4 bg-border" />
        {(["month", "week"] as ViewMode[]).map((mode) => (
          <button key={mode} onClick={() => onViewModeChange(mode)} className={`px-3 py-1.5 text-xs rounded-md transition-all capitalize ${viewMode === mode ? "bg-white text-dark font-medium shadow-sm" : "text-muted-dark hover:text-dark"}`}>{mode}</button>
        ))}
      </div>
    </div>
  );
}
