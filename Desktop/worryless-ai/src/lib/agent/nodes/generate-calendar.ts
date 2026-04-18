import type { CalendarAgentStateType } from "../calendar-state";
import { ChatOpenAI } from "@langchain/openai";
import {
  CALENDAR_GENERATION_SYSTEM_PROMPT,
  CALENDAR_GENERATION_USER_PROMPT,
} from "../prompts/calendar-prompts";
import { db } from "@/lib/db";
import { contentCalendars, calendarPosts } from "@/lib/db/schema";

export async function generateCalendar(
  state: CalendarAgentStateType,
): Promise<Partial<CalendarAgentStateType>> {
  if (!state.wizardAnswers) {
    return {};
  }

  state.emitEvent("status", {
    task: "generate_calendar",
    message: "Building your content calendar...",
  });

  state.emitEvent("message", {
    role: "agent",
    content:
      "I'm crafting your 4-week content calendar based on your brand DNA and preferences. This takes about a minute...",
  });

  const llm = new ChatOpenAI({
    modelName: "google/gemini-2.5-pro-preview",
    temperature: 0.7,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    },
  });

  const { platforms, frequency, contentGoals, additionalContext } = state.wizardAnswers;

  const userPrompt = CALENDAR_GENERATION_USER_PROMPT({
    businessProfile: state.businessProfile,
    brandGuidelines: state.brandGuidelines,
    marketResearch: state.marketResearch,
    marketingStrategy: state.marketingStrategy,
    platforms,
    frequency,
    additionalContext: [
      contentGoals ? `Content goals: ${contentGoals}` : "",
      additionalContext || "",
    ]
      .filter(Boolean)
      .join(". "),
  });

  let calendarData: { contentPillars: string[]; posts: Array<Record<string, unknown>> };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await llm.invoke([
        { role: "system", content: CALENDAR_GENERATION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ]);

      const text = typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");

      calendarData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      break;
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }

  const [calendar] = await db
    .insert(contentCalendars)
    .values({
      organizationId: state.organizationId,
      platforms,
      frequency,
      contentPillars: calendarData!.contentPillars,
      wizardAnswers: state.wizardAnswers as unknown as Record<string, unknown>,
    })
    .returning();

  const postRecords = calendarData!.posts.map((post) => ({
    calendarId: calendar.id,
    organizationId: state.organizationId,
    platform: post.platform as string,
    contentFormat: post.contentFormat as string,
    scheduledDate: post.scheduledDate as string,
    scheduledTime: post.scheduledTime as string,
    caption: post.caption as string,
    hashtags: (post.hashtags as string[]) || [],
    contentPillar: post.contentPillar as string,
    weekNumber: String(post.weekNumber),
    dayOfWeek: String(post.dayOfWeek),
    mediaPrompt: (post.mediaDescription as string) || null,
    status: "planned" as const,
    mediaStatus: "pending" as const,
  }));

  const savedPosts = await db
    .insert(calendarPosts)
    .values(postRecords)
    .returning();

  state.emitEvent("status", {
    task: "generate_calendar",
    message: `Created ${savedPosts.length} posts across ${platforms.length} platforms`,
  });

  return {
    calendarId: calendar.id,
    calendarPosts: savedPosts as unknown as CalendarAgentStateType["calendarPosts"],
    contentPillars: calendarData!.contentPillars,
  };
}
