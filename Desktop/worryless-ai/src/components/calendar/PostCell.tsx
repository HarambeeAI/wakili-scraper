"use client";

import type { CalendarPost } from "@/types/calendar";
import PlatformIcon from "./PlatformIcon";

interface PostCellProps {
  post: CalendarPost;
  compact?: boolean;
  onClick: (post: CalendarPost) => void;
}

export default function PostCell({ post, compact = false, onClick }: PostCellProps) {
  return (
    <PlatformIcon
      platform={post.platform}
      size={compact ? "sm" : "md"}
      hasPost={true}
      onClick={() => onClick(post)}
    />
  );
}
