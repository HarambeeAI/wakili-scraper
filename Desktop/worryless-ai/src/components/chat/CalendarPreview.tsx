"use client";

import { useState } from "react";
import type { CalendarPost, SocialPlatform } from "@/types/calendar";

interface CalendarPreviewProps {
  posts: CalendarPost[];
  platforms: SocialPlatform[];
  weekCount: number;
  onApprove: () => void;
  disabled?: boolean;
}

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  instagram: "bg-pink-500",
  tiktok: "bg-gray-800",
  linkedin: "bg-blue-600",
  facebook: "bg-blue-500",
  x: "bg-gray-800",
  youtube: "bg-red-600",
};

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  youtube: "YouTube",
};

const FORMAT_LABELS: Record<string, string> = {
  image_post: "Post",
  carousel: "Carousel",
  reel: "Reel",
  video: "Video",
  story: "Story",
  text_post: "Post",
};

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPreview({
  posts,
  platforms,
  weekCount,
  onApprove,
  disabled = false,
}: CalendarPreviewProps) {
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [approved, setApproved] = useState(false);

  if (approved) {
    return (
      <div className="ml-9 max-w-[560px] rounded-2xl border border-[#e3e3e8] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-5 py-4 flex items-center gap-2.5">
        <svg
          className="w-5 h-5 text-emerald-500 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-[13.5px] text-muted-dark">
          Calendar approved &mdash; generating your first week&apos;s
          content&hellip;
        </span>
      </div>
    );
  }

  const weekPosts = posts.filter((p) => p.weekNumber === selectedWeek);

  const dayBuckets: CalendarPost[][] = Array.from({ length: 7 }, () => []);
  weekPosts.forEach((p) => {
    if (p.dayOfWeek >= 0 && p.dayOfWeek < 7) {
      dayBuckets[p.dayOfWeek].push(p);
    }
  });

  function handleApprove() {
    if (disabled) return;
    setApproved(true);
    onApprove();
  }

  return (
    <div className="ml-9 max-w-[560px] rounded-2xl border border-[#e3e3e8] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#e3e3e8]">
        <div>
          <h3 className="text-[14px] font-semibold text-dark leading-tight">
            Content Calendar Preview
          </h3>
          <p className="text-[12px] text-muted mt-0.5">
            {posts.length} post{posts.length !== 1 && "s"} planned
          </p>
        </div>

        {/* Week selector */}
        <div className="flex gap-1">
          {Array.from({ length: weekCount }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setSelectedWeek(w)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                selectedWeek === w
                  ? "bg-primary text-white"
                  : "text-muted-dark hover:bg-gray-100"
              }`}
            >
              W{w}
            </button>
          ))}
        </div>
      </div>

      {/* 7-column grid */}
      <div className="px-5 py-3">
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-semibold text-muted pb-1"
            >
              {d}
            </div>
          ))}

          {/* Day cells */}
          {dayBuckets.map((bucket, i) => (
            <div
              key={i}
              className="min-h-[48px] rounded-md border border-[#e3e3e8] bg-light/50 p-1 space-y-0.5"
            >
              {bucket.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-1"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PLATFORM_COLORS[post.platform]}`}
                  />
                  <span className="text-[9px] text-muted-dark truncate">
                    {FORMAT_LABELS[post.contentFormat] ?? post.contentFormat}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-5 pb-3">
        {platforms.map((p) => (
          <div key={p} className="flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full ${PLATFORM_COLORS[p]}`}
            />
            <span className="text-[10px] text-muted">
              {PLATFORM_LABELS[p]}
            </span>
          </div>
        ))}
      </div>

      {/* Approve button */}
      <div className="px-5 pb-4">
        <button
          type="button"
          disabled={disabled}
          onClick={handleApprove}
          className="w-full py-2 rounded-lg text-[13px] font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Approve Calendar
        </button>
      </div>
    </div>
  );
}
