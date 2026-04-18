"use client";

import type { MediaType, SocialPlatform } from "@/types/calendar";

interface ContentPreviewCardProps {
  mediaUrl: string;
  mediaType: MediaType;
  caption: string;
  platform: SocialPlatform;
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  youtube: "YouTube",
};

export default function ContentPreviewCard({
  mediaUrl,
  mediaType,
  caption,
  platform,
}: ContentPreviewCardProps) {
  return (
    <div className="ml-9 max-w-[320px] rounded-2xl border border-[#e3e3e8] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Media area */}
      <div className="relative aspect-square bg-gray-100">
        {mediaType === "video" ? (
          <video
            src={mediaUrl}
            controls
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <img
            src={mediaUrl}
            alt="Generated content"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Platform badge */}
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-semibold">
          {PLATFORM_LABELS[platform]}
        </span>
      </div>

      {/* Caption */}
      <div className="px-4 py-3">
        <p className="text-[12.5px] text-dark leading-[1.5] line-clamp-3">
          {caption}
        </p>
      </div>
    </div>
  );
}
