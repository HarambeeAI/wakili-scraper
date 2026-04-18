"use client";

import type { CalendarPost } from "@/types/calendar";

interface PostCellProps {
  post: CalendarPost;
  compact?: boolean;
  onClick: (post: CalendarPost) => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "border-l-pink-500",
  tiktok: "border-l-gray-800",
  linkedin: "border-l-blue-600",
  facebook: "border-l-blue-500",
  x: "border-l-gray-600",
  youtube: "border-l-red-600",
};

const STATUS_DOT: Record<string, string> = {
  planned: "bg-gray-300",
  generating: "bg-yellow-400 animate-pulse",
  ready: "bg-emerald-400",
  approved: "bg-blue-400",
  published: "bg-emerald-600",
  failed: "bg-red-400",
};

const FORMAT_LABELS: Record<string, string> = {
  image_post: "Post",
  carousel: "Carousel",
  reel: "Reel",
  video: "Video",
  story: "Story",
  text_post: "Text",
};

export default function PostCell({ post, compact = false, onClick }: PostCellProps) {
  return (
    <button onClick={() => onClick(post)} className={`w-full text-left border-l-2 ${PLATFORM_COLORS[post.platform] || "border-l-gray-300"} bg-white hover:bg-light rounded-r-md transition-colors group ${compact ? "px-1.5 py-1" : "px-2.5 py-2"}`}>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[post.status]}`} />
        <span className={`text-dark truncate ${compact ? "text-[9px]" : "text-[11px]"}`}>{FORMAT_LABELS[post.contentFormat] || post.contentFormat}</span>
        <span className={`text-muted ml-auto flex-shrink-0 ${compact ? "text-[8px]" : "text-[10px]"}`}>{post.scheduledTime}</span>
      </div>
      {!compact && <p className="text-[10px] text-muted-dark truncate mt-0.5">{post.caption.slice(0, 50)}</p>}
    </button>
  );
}
