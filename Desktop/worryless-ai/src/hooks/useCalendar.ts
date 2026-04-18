"use client";

import { useState, useEffect, useCallback } from "react";
import type { CalendarPost, ContentCalendar } from "@/types/calendar";

interface UseCalendarOptions {
  orgId: string;
}

export function useCalendar({ orgId }: UseCalendarOptions) {
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [calendar, setCalendar] = useState<ContentCalendar | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar/${orgId}`);
      const data = await res.json();
      setPosts(data.posts || []);
      setCalendar(data.calendar || null);
    } catch (err) {
      console.error("Failed to fetch calendar:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const updatePost = useCallback(async (postId: string, updates: Partial<CalendarPost>) => {
    const res = await fetch(`/api/calendar/${orgId}/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const updated = await res.json();
    setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    return updated;
  }, [orgId]);

  const deletePost = useCallback(async (postId: string) => {
    await fetch(`/api/calendar/${orgId}/${postId}`, { method: "DELETE" });
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, [orgId]);

  const regenerateContent = useCallback(async (postId: string, customPrompt?: string) => {
    const res = await fetch(`/api/calendar/${orgId}/${postId}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: customPrompt }),
    });
    const updated = await res.json();
    setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    return updated;
  }, [orgId]);

  return { posts, calendar, loading, refetch: fetchPosts, updatePost, deletePost, regenerateContent };
}
