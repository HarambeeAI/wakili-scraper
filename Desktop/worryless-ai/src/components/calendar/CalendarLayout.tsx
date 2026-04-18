"use client";

import { useState, useMemo, useEffect } from "react";
import { useCalendar } from "@/hooks/useCalendar";
import CalendarHeader from "./CalendarHeader";
import MonthView from "./MonthView";
import WeekView, { getWeekRange } from "./WeekView";
import PostDetailModal from "./PostDetailModal";
import PlatformIcon from "./PlatformIcon";
import type { CalendarPost, SocialPlatform } from "@/types/calendar";

type ViewMode = "month" | "week";

interface CalendarLayoutProps {
  orgId: string;
  orgSlug: string;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarLayout({
  orgId,
  orgSlug,
}: CalendarLayoutProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const {
    posts,
    calendar,
    loading,
    updatePost,
    deletePost,
    regenerateContent,
  } = useCalendar({ orgId });

  // Auto-navigate to the month where posts exist
  useEffect(() => {
    if (posts.length > 0) {
      const firstDate = posts.map((p) => p.scheduledDate).sort()[0];
      if (firstDate) {
        const [y, m, d] = firstDate.split("-").map(Number);
        const postsDate = new Date(y, m - 1, d);
        if (
          postsDate.getFullYear() !== currentDate.getFullYear() ||
          postsDate.getMonth() !== currentDate.getMonth()
        ) {
          setCurrentDate(postsDate);
        }
      }
    }
  }, [posts]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredPosts = posts;

  function navigate(direction: "prev" | "next" | "today") {
    if (direction === "today") {
      setCurrentDate(new Date());
      return;
    }
    const d = new Date(currentDate);
    if (viewMode === "month")
      d.setMonth(d.getMonth() + (direction === "next" ? 1 : -1));
    else
      d.setDate(d.getDate() + (direction === "next" ? 7 : -7));
    setCurrentDate(d);
  }

  function navigateDay(direction: "prev" | "next") {
    if (!selectedDay) return;
    const d = new Date(selectedDay);
    d.setDate(d.getDate() + (direction === "next" ? 1 : -1));
    setSelectedDay(d);
  }

  const weekRange = useMemo(() => getWeekRange(currentDate), [currentDate]);

  const selectedDayPosts = useMemo(() => {
    if (!selectedDay) return [];
    const key = formatDateKey(selectedDay);
    return filteredPosts.filter((p) => p.scheduledDate === key);
  }, [selectedDay, filteredPosts]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Title header */}
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-xl font-bold text-dark">Marketing Calendar</h1>
        <p className="text-sm text-muted">Plan and schedule your social media content</p>
      </div>

      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onNavigate={navigate}
        weekStart={viewMode === "week" ? weekRange.start : undefined}
        weekEnd={viewMode === "week" ? weekRange.end : undefined}
      />

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viewMode === "month" ? (
          <MonthView
            currentDate={currentDate}
            posts={filteredPosts}
            onPostClick={setSelectedPost}
            onDayClick={setSelectedDay}
          />
        ) : (
          <WeekView
            currentDate={currentDate}
            posts={filteredPosts}
            onPostClick={setSelectedPost}
            onDayClick={setSelectedDay}
          />
        )}
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="border-t border-border bg-white px-6 py-6">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => navigateDay("prev")}
              className="w-8 h-8 rounded-lg hover:bg-light flex items-center justify-center text-muted-dark transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <div className="text-center flex-1">
              <h3 className="text-lg font-semibold text-dark">
                {selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </h3>
              {selectedDayPosts.length > 0 ? (
                <div className="flex items-center justify-center gap-2 mt-3">
                  {selectedDayPosts.map((post) => (
                    <PlatformIcon
                      key={post.id}
                      platform={post.platform}
                      size="md"
                      hasPost={true}
                      onClick={() => setSelectedPost(post)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted mt-2">No content scheduled for this day.</p>
              )}
              <button
                type="button"
                className="mt-3 px-4 py-1.5 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
              >
                + Add Content
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigateDay("next")}
              className="w-8 h-8 rounded-lg hover:bg-light flex items-center justify-center text-muted-dark transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
        </div>
      )}

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onUpdate={updatePost}
          onDelete={deletePost}
          onRegenerate={regenerateContent}
        />
      )}
    </div>
  );
}
