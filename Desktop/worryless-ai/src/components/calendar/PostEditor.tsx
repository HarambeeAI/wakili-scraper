"use client";

import { useState } from "react";
import type { CalendarPost } from "@/types/calendar";

interface PostEditorProps {
  post: CalendarPost;
  onSave: (updates: Partial<CalendarPost>) => void;
  onCancel: () => void;
}

export default function PostEditor({ post, onSave, onCancel }: PostEditorProps) {
  const [caption, setCaption] = useState(post.caption);
  const [hashtags, setHashtags] = useState(post.hashtags.join(" "));
  const [scheduledTime, setScheduledTime] = useState(post.scheduledTime);

  function handleSave() {
    onSave({ caption, hashtags: hashtags.split(/\s+/).filter(Boolean), scheduledTime });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-[11px] font-medium text-muted-dark mb-1 block">Caption</label>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full text-xs text-dark border border-border rounded-lg px-3 py-2 min-h-[120px] resize-y outline-none focus:border-primary focus:ring-1 focus:ring-primary/20" />
        <p className="text-[10px] text-muted mt-1">{caption.length} characters</p>
      </div>
      <div>
        <label className="text-[11px] font-medium text-muted-dark mb-1 block">Hashtags</label>
        <input type="text" value={hashtags} onChange={(e) => setHashtags(e.target.value)} className="w-full text-xs text-dark border border-border rounded-lg px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20" placeholder="#hashtag1 #hashtag2" />
      </div>
      <div>
        <label className="text-[11px] font-medium text-muted-dark mb-1 block">Scheduled Time</label>
        <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="text-xs text-dark border border-border rounded-lg px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-xs text-muted-dark hover:text-dark border border-border rounded-lg transition-colors">Cancel</button>
        <button onClick={handleSave} className="px-4 py-2 text-xs text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors">Save Changes</button>
      </div>
    </div>
  );
}
