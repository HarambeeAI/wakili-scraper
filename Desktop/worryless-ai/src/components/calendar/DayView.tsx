"use client";

import type { CalendarPost } from "@/types/calendar";
import PostCell from "./PostCell";

interface DayViewProps {
  currentDate: Date;
  posts: CalendarPost[];
  onPostClick: (post: CalendarPost) => void;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function DayView({ currentDate, posts, onPostClick }: DayViewProps) {
  const dateKey = formatDateKey(currentDate);
  const dayPosts = posts.filter((p) => p.scheduledDate === dateKey);
  const dayLabel = currentDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const byHour: Record<number, CalendarPost[]> = {};
  for (const post of dayPosts) {
    const hour = parseInt(post.scheduledTime.split(":")[0], 10);
    if (!byHour[hour]) byHour[hour] = [];
    byHour[hour].push(post);
  }

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-border px-6 py-3">
        <h2 className="text-sm font-medium text-dark">{dayLabel}</h2>
        <p className="text-[11px] text-muted">{dayPosts.length} posts scheduled</p>
      </div>
      <div className="max-w-3xl mx-auto">
        {HOURS.map((hour) => {
          const hourPosts = byHour[hour] || [];
          return (
            <div key={hour} className="flex min-h-[56px] border-b border-border">
              <div className="w-16 text-[11px] text-muted text-right pr-3 pt-2 flex-shrink-0">{hour.toString().padStart(2, "0")}:00</div>
              <div className="flex-1 border-l border-border p-1.5 flex flex-col gap-1">
                {hourPosts.map((post) => (<PostCell key={post.id} post={post} onClick={onPostClick} />))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
