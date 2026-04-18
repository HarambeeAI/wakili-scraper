"use client";

import type { SocialPlatform } from "@/types/calendar";

interface PlatformIconProps {
  platform: SocialPlatform;
  size?: "sm" | "md";
  hasPost?: boolean;
  onClick?: () => void;
}

const PLATFORM_CONFIGS: Record<SocialPlatform, { bg: string; icon: string }> = {
  instagram: { bg: "bg-gradient-to-br from-pink-500 to-purple-600", icon: "IG" },
  tiktok: { bg: "bg-black", icon: "♪" },
  linkedin: { bg: "bg-blue-600", icon: "in" },
  facebook: { bg: "bg-blue-500", icon: "f" },
  x: { bg: "bg-black", icon: "X" },
  youtube: { bg: "bg-red-600", icon: "▶" },
};

export default function PlatformIcon({ platform, size = "md", hasPost = true, onClick }: PlatformIconProps) {
  const config = PLATFORM_CONFIGS[platform];
  const sizeClasses = size === "sm" ? "w-5 h-5 text-[8px]" : "w-7 h-7 text-[10px]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${sizeClasses} rounded-lg ${config.bg} flex items-center justify-center text-white font-bold flex-shrink-0 transition-all ${
        hasPost ? "opacity-100 shadow-sm" : "opacity-30 border border-dashed border-gray-300 !bg-transparent !text-gray-400"
      } ${onClick ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
    >
      {config.icon}
    </button>
  );
}
