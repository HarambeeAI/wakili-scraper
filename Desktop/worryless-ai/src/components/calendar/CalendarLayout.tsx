"use client";

import { useState, useMemo } from "react";
import { useCalendar } from "@/hooks/useCalendar";
import CalendarHeader from "./CalendarHeader";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";
import PostDetailModal from "./PostDetailModal";
import type { CalendarPost, SocialPlatform } from "@/types/calendar";

type ViewMode = "month" | "week" | "day";

interface CalendarLayoutProps {
  orgId: string;
  orgSlug: string;
}

export default function CalendarLayout({ orgId, orgSlug }: CalendarLayoutProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | null>(null);
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);

  const { posts, calendar, loading, updatePost, deletePost, regenerateContent } = useCalendar({ orgId });

  const filteredPosts = useMemo(() => {
    if (!platformFilter) return posts;
    return posts.filter((p) => p.platform === platformFilter);
  }, [posts, platformFilter]);

  const platforms = useMemo(() => {
    return [...new Set(posts.map((p) => p.platform))] as SocialPlatform[];
  }, [posts]);

  function navigate(direction: "prev" | "next" | "today") {
    if (direction === "today") { setCurrentDate(new Date()); return; }
    const d = new Date(currentDate);
    if (viewMode === "month") d.setMonth(d.getMonth() + (direction === "next" ? 1 : -1));
    else if (viewMode === "week") d.setDate(d.getDate() + (direction === "next" ? 7 : -7));
    else d.setDate(d.getDate() + (direction === "next" ? 1 : -1));
    setCurrentDate(d);
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <CalendarHeader currentDate={currentDate} viewMode={viewMode} onViewModeChange={setViewMode} onNavigate={navigate} platformFilter={platformFilter} onPlatformFilterChange={setPlatformFilter} platforms={platforms} />
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viewMode === "month" ? (
          <MonthView currentDate={currentDate} posts={filteredPosts} onPostClick={setSelectedPost} />
        ) : viewMode === "week" ? (
          <WeekView currentDate={currentDate} posts={filteredPosts} onPostClick={setSelectedPost} />
        ) : (
          <DayView currentDate={currentDate} posts={filteredPosts} onPostClick={setSelectedPost} />
        )}
      </div>
      {selectedPost && (
        <PostDetailModal post={selectedPost} onClose={() => setSelectedPost(null)} onUpdate={updatePost} onDelete={deletePost} onRegenerate={regenerateContent} />
      )}
    </div>
  );
}
