"use client";

import type { CalendarPost } from "@/types/calendar";
import PostCell from "./PostCell";

interface WeekViewProps {
  currentDate: Date;
  posts: CalendarPost[];
  onPostClick: (post: CalendarPost) => void;
}

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

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function WeekView({ currentDate, posts, onPostClick }: WeekViewProps) {
  const weekDays = getWeekDays(currentDate);
  const today = formatDateKey(new Date());

  const postsByDateHour: Record<string, CalendarPost[]> = {};
  for (const post of posts) {
    const hour = parseInt(post.scheduledTime.split(":")[0], 10);
    const key = `${post.scheduledDate}-${hour}`;
    if (!postsByDateHour[key]) postsByDateHour[key] = [];
    postsByDateHour[key].push(post);
  }

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-border grid grid-cols-[60px_repeat(7,1fr)]">
        <div className="border-r border-border" />
        {weekDays.map((day) => {
          const key = formatDateKey(day);
          const isToday = key === today;
          return (
            <div key={key} className={`text-center py-2 border-r border-border ${isToday ? "bg-primary/5" : ""}`}>
              <div className="text-[10px] text-muted">{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
              <div className={`text-sm font-medium ${isToday ? "text-primary" : "text-dark"}`}>{day.getDate()}</div>
            </div>
          );
        })}
      </div>
      {HOURS.map((hour) => (
        <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[60px]">
          <div className="border-r border-b border-border text-[10px] text-muted text-right pr-2 pt-1">{hour.toString().padStart(2, "0")}:00</div>
          {weekDays.map((day) => {
            const key = `${formatDateKey(day)}-${hour}`;
            const cellPosts = postsByDateHour[key] || [];
            return (
              <div key={key} className="border-r border-b border-border p-0.5">
                {cellPosts.map((post) => (<PostCell key={post.id} post={post} compact onClick={onPostClick} />))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
