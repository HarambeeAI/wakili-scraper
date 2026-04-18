"use client";

import type { CalendarPost } from "@/types/calendar";
import PlatformIcon from "./PlatformIcon";

interface WeekViewProps {
  currentDate: Date;
  posts: CalendarPost[];
  onPostClick: (post: CalendarPost) => void;
  onDayClick?: (date: Date) => void;
}

const DAY_ABBRS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return days;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function WeekView({ currentDate, posts, onPostClick, onDayClick }: WeekViewProps) {
  const weekDays = getWeekDays(currentDate);
  const today = formatDateKey(new Date());

  const postsByDate: Record<string, CalendarPost[]> = {};
  for (const post of posts) {
    if (!postsByDate[post.scheduledDate]) postsByDate[post.scheduledDate] = [];
    postsByDate[post.scheduledDate].push(post);
  }

  return (
    <div className="grid grid-cols-7 gap-3 px-6 py-4">
      {weekDays.map((day) => {
        const key = formatDateKey(day);
        const isToday = key === today;
        const isSunday = day.getDay() === 0;
        const dayPosts = postsByDate[key] || [];

        return (
          <button
            type="button"
            key={key}
            onClick={() => onDayClick?.(day)}
            className={`rounded-2xl border ${isToday ? "border-emerald-400 bg-emerald-50/30" : "border-border"} p-4 text-left transition-all hover:shadow-md cursor-pointer`}
          >
            <div className="text-center mb-4">
              <div className={`text-2xl font-bold ${isSunday ? "text-red-500" : isToday ? "text-emerald-500" : "text-dark"}`}>
                {day.getDate()}
              </div>
              <div className="text-xs font-semibold text-muted uppercase">
                {DAY_ABBRS[day.getDay()]}
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              {dayPosts.map((post) => (
                <PlatformIcon
                  key={post.id}
                  platform={post.platform}
                  size="md"
                  hasPost={true}
                  onClick={() => onPostClick(post)}
                />
              ))}
              {dayPosts.length === 0 && (
                <div className="w-7 h-7 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                  <span className="text-gray-300 text-xs">+</span>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}
