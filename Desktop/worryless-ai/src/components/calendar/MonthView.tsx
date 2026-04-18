"use client";

import type { CalendarPost } from "@/types/calendar";
import PlatformIcon from "./PlatformIcon";

interface MonthViewProps {
  currentDate: Date;
  posts: CalendarPost[];
  onPostClick: (post: CalendarPost) => void;
  onDayClick?: (date: Date) => void;
}

function getMonthDays(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];
  const startDow = firstDay.getDay();
  for (let i = startDow - 1; i >= 0; i--) days.push(new Date(year, month, -i));
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length < 42) days.push(new Date(year, month + 1, days.length - lastDay.getDate() - startDow + 1));
  return days;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MonthView({ currentDate, posts, onPostClick, onDayClick }: MonthViewProps) {
  const days = getMonthDays(currentDate);
  const today = formatDateKey(new Date());
  const currentMonth = currentDate.getMonth();

  const postsByDate: Record<string, CalendarPost[]> = {};
  for (const post of posts) {
    if (!postsByDate[post.scheduledDate]) postsByDate[post.scheduledDate] = [];
    postsByDate[post.scheduledDate].push(post);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7 border-b border-border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-center text-[11px] text-muted font-medium py-2">{day}</div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7 grid-rows-6">
        {days.map((day, idx) => {
          const key = formatDateKey(day);
          const dayPosts = postsByDate[key] || [];
          const isToday = key === today;
          const isCurrentMonth = day.getMonth() === currentMonth;
          return (
            <button
              type="button"
              key={idx}
              onClick={() => onDayClick?.(day)}
              className={`border-b border-r border-border p-1.5 min-h-[100px] text-left transition-colors hover:bg-light/60 cursor-pointer ${isCurrentMonth ? "bg-white" : "bg-light/40"}`}
            >
              <div className={`text-[11px] mb-1.5 ${isToday ? "w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-medium" : isCurrentMonth ? "text-dark" : "text-muted"}`}>
                {day.getDate()}
              </div>
              <div className="flex flex-wrap gap-1">
                {dayPosts.slice(0, 6).map((post) => (
                  <PlatformIcon
                    key={post.id}
                    platform={post.platform}
                    size="sm"
                    hasPost={true}
                    onClick={() => onPostClick(post)}
                  />
                ))}
                {dayPosts.length > 6 && <span className="text-[9px] text-muted self-center">+{dayPosts.length - 6}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
