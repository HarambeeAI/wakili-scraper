"use client";

import { useState } from "react";
import type { CalendarPost } from "@/types/calendar";
import PostEditor from "./PostEditor";

interface PostDetailModalProps {
  post: CalendarPost;
  onClose: () => void;
  onUpdate: (postId: string, updates: Partial<CalendarPost>) => Promise<CalendarPost>;
  onDelete: (postId: string) => Promise<void>;
  onRegenerate: (postId: string, customPrompt?: string) => Promise<CalendarPost>;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn", facebook: "Facebook", x: "X", youtube: "YouTube",
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  planned: { bg: "bg-gray-100", text: "text-gray-700" },
  generating: { bg: "bg-yellow-100", text: "text-yellow-700" },
  ready: { bg: "bg-emerald-100", text: "text-emerald-700" },
  approved: { bg: "bg-blue-100", text: "text-blue-700" },
  published: { bg: "bg-emerald-100", text: "text-emerald-800" },
  failed: { bg: "bg-red-100", text: "text-red-700" },
};

export default function PostDetailModal({ post, onClose, onUpdate, onDelete, onRegenerate }: PostDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [currentPost, setCurrentPost] = useState(post);

  async function handleSave(updates: Partial<CalendarPost>) {
    const updated = await onUpdate(currentPost.id, updates);
    setCurrentPost(updated);
    setEditing(false);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const updated = await onRegenerate(currentPost.id);
      setCurrentPost(updated);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    await onDelete(currentPost.id);
    onClose();
  }

  const statusStyle = STATUS_STYLES[currentPost.status] || STATUS_STYLES.planned;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-dark capitalize">{PLATFORM_LABELS[currentPost.platform]} {currentPost.contentFormat.replace("_", " ")}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyle.bg} ${statusStyle.text}`}>{currentPost.status}</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-dark transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-5 py-4">
          {currentPost.mediaUrl && (
            <div className="mb-4 rounded-lg overflow-hidden bg-gray-100">
              {currentPost.mediaType === "video" ? (
                <video src={currentPost.mediaUrl} className="w-full max-h-[300px] object-contain" controls muted playsInline />
              ) : (
                <img src={currentPost.mediaUrl} alt="Post media" className="w-full max-h-[300px] object-contain" />
              )}
            </div>
          )}
          {editing ? (
            <PostEditor post={currentPost} onSave={handleSave} onCancel={() => setEditing(false)} />
          ) : (
            <>
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2 text-[11px] text-muted">
                  <span>Pillar: {currentPost.contentPillar}</span>
                  <span>{currentPost.scheduledDate} at {currentPost.scheduledTime}</span>
                </div>
                <p className="text-xs text-dark leading-relaxed whitespace-pre-wrap">{currentPost.caption}</p>
                {currentPost.hashtags.length > 0 && <p className="text-xs text-primary mt-2">{currentPost.hashtags.join(" ")}</p>}
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-xs text-dark border border-border rounded-lg hover:bg-light transition-colors">Edit</button>
                <button onClick={handleRegenerate} disabled={regenerating} className="px-3 py-1.5 text-xs text-dark border border-border rounded-lg hover:bg-light transition-colors disabled:opacity-40">{regenerating ? "Regenerating..." : "Regenerate Media"}</button>
                <button onClick={handleDelete} className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors ml-auto">Delete</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
