import type { CalendarAgentStateType } from "../calendar-state";

export async function presentCalendar(
  state: CalendarAgentStateType,
): Promise<Partial<CalendarAgentStateType>> {
  if (!state.calendarPosts.length) return {};

  const byWeek: Record<number, typeof state.calendarPosts> = {};
  for (const post of state.calendarPosts) {
    const week = post.weekNumber;
    if (!byWeek[week]) byWeek[week] = [];
    byWeek[week].push(post);
  }

  const platformCounts: Record<string, number> = {};
  for (const post of state.calendarPosts) {
    platformCounts[post.platform] = (platformCounts[post.platform] || 0) + 1;
  }

  const summaryLines = Object.entries(platformCounts)
    .map(([platform, count]) => `- **${platform}**: ${count} posts`)
    .join("\n");

  state.emitEvent("message", {
    role: "agent",
    content: `Here's your 4-week content calendar! I've planned ${state.calendarPosts.length} posts across your platforms:\n\n${summaryLines}\n\nContent pillars: ${state.contentPillars.join(", ")}\n\nTake a look at the calendar preview below. Once you approve it, I'll start creating the visuals and videos for your first week's content.`,
  });

  state.emitEvent("calendar_preview", {
    calendarId: state.calendarId,
    posts: state.calendarPosts,
    platforms: [...new Set(state.calendarPosts.map((p) => p.platform))],
    weekCount: Object.keys(byWeek).length,
  });

  return {};
}
