// PA calendar tools: listCalendarEvents, createCalendarEvent, detectCalendarConflicts, analyzeTimeAllocation
// Covers PA-05, PA-06, PA-09, PA-10

import { google } from "googleapis";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getGoogleClient } from "./google-auth.js";
import { callLLM } from "../../llm/client.js";
import { interruptForApproval } from "../../hitl/interrupt-handler.js";
import type {
  CalendarEvent,
  CreateEventInput,
  ConflictResult,
  TimeAllocation,
  BusySlot,
} from "./types.js";

/** Format an ISO date to YYYY-MM-DD label */
function toDateLabel(isoString: string): string {
  return isoString.slice(0, 10);
}

/**
 * PA-05: List calendar events within a date range.
 * Defaults to the next 7 days when no range is provided.
 */
export async function listCalendarEvents(
  userId: string,
  timeMin?: string,
  timeMax?: string,
): Promise<{ events: CalendarEvent[]; count: number; message: string }> {
  const auth = await getGoogleClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const effectiveMin = timeMin ?? now.toISOString();
  const effectiveMax =
    timeMax ??
    new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await calendar.events.list({
    calendarId: "primary",
    timeMin: effectiveMin,
    timeMax: effectiveMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });

  const items = data.items ?? [];
  if (items.length === 0) {
    const dateRange = `${toDateLabel(effectiveMin)} to ${toDateLabel(effectiveMax)}`;
    return {
      events: [],
      count: 0,
      message: `No events found for ${dateRange}.`,
    };
  }

  const events: CalendarEvent[] = items.map((item) => ({
    id: item.id ?? "",
    summary: item.summary ?? "(no title)",
    description: item.description ?? null,
    location: item.location ?? null,
    start: item.start?.dateTime ?? item.start?.date ?? "",
    end: item.end?.dateTime ?? item.end?.date ?? "",
    attendees: (item.attendees ?? []).map((a) => ({
      email: a.email ?? "",
      displayName: a.displayName ?? undefined,
      responseStatus: a.responseStatus ?? undefined,
    })),
    htmlLink: item.htmlLink ?? null,
  }));

  return { events, count: events.length, message: `Found ${events.length} event(s).` };
}

/**
 * PA-06: Create a calendar event with freeBusy check and mandatory HITL approval.
 */
export async function createCalendarEvent(
  userId: string,
  agentType: string,
  eventDetails: CreateEventInput,
): Promise<{
  created: boolean;
  conflict?: boolean;
  busySlots?: BusySlot[];
  eventId?: string;
  htmlLink?: string;
  message: string;
}> {
  const auth = await getGoogleClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  // Check availability via freeBusy query
  const { data: freeBusy } = await calendar.freebusy.query({
    requestBody: {
      timeMin: eventDetails.startTime,
      timeMax: eventDetails.endTime,
      items: [{ id: "primary" }],
    },
  });

  const busySlots: BusySlot[] =
    (freeBusy.calendars?.["primary"]?.busy ?? []).map((slot) => ({
      start: slot.start ?? "",
      end: slot.end ?? "",
    }));

  if (busySlots.length > 0) {
    return {
      created: false,
      conflict: true,
      busySlots,
      message: `Conflict detected: you have ${busySlots.length} event(s) during this time.`,
    };
  }

  // HITL: require approval before creating event
  const approval = interruptForApproval({
    action: "create_calendar_event",
    agentType: agentType as any,
    description: `Create calendar event: "${eventDetails.summary}" from ${eventDetails.startTime} to ${eventDetails.endTime}`,
    payload: eventDetails as unknown as Record<string, unknown>,
  });

  if (!approval.approved) {
    return { created: false, message: "Event creation cancelled by user." };
  }

  const { data: event } = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all",
    requestBody: {
      summary: eventDetails.summary,
      description: eventDetails.description,
      location: eventDetails.location,
      start: { dateTime: eventDetails.startTime },
      end: { dateTime: eventDetails.endTime },
      attendees: eventDetails.attendees?.map((email) => ({ email })),
    },
  });

  return {
    created: true,
    eventId: event.id ?? undefined,
    htmlLink: event.htmlLink ?? undefined,
    message: "Calendar event created.",
  };
}

/**
 * PA-09: Detect overlapping calendar events for a given date.
 * Returns conflict pairs and LLM-generated resolution suggestions.
 */
export async function detectCalendarConflicts(
  userId: string,
  date?: string,
): Promise<ConflictResult> {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const startOfDay = `${targetDate}T00:00:00Z`;
  const endOfDay = `${targetDate}T23:59:59Z`;

  const { events } = await listCalendarEvents(userId, startOfDay, endOfDay);

  if (events.length === 0) {
    return { hasConflict: false, busySlots: [] };
  }

  // Sort by start time
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));

  // Find overlapping pairs
  const conflictingSlots: BusySlot[] = [];
  const conflictDescriptions: string[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    // Overlap: current ends after next starts
    if (current.end > next.start) {
      conflictingSlots.push({ start: next.start, end: current.end });
      conflictDescriptions.push(
        `"${current.summary}" (ends ${current.end}) overlaps with "${next.summary}" (starts ${next.start})`,
      );
    }
  }

  if (conflictingSlots.length === 0) {
    return { hasConflict: false, busySlots: [] };
  }

  // Ask LLM for resolution suggestions
  const conflictText = conflictDescriptions.join("\n");
  const llmResult = await callLLM(
    [
      new SystemMessage(
        "You are a scheduling assistant. Provide concise, actionable suggestions to resolve calendar conflicts.",
      ),
      new HumanMessage(
        `I have the following calendar conflicts on ${targetDate}:\n\n${conflictText}\n\nPlease provide 2-3 specific suggestions to resolve these conflicts.`,
      ),
    ],
  );

  const suggestions = llmResult.content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(0, 5);

  return {
    hasConflict: true,
    busySlots: conflictingSlots,
    suggestions,
  };
}

/**
 * PA-10: Analyze time allocation between meetings and focus time over N days.
 * Returns a breakdown of meeting hours, focus hours, and busiest day.
 */
export async function analyzeTimeAllocation(
  userId: string,
  days: number = 7,
): Promise<TimeAllocation & { message: string }> {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const endDate = now.toISOString();

  const { events } = await listCalendarEvents(userId, startDate, endDate);

  // Calculate meeting hours from event durations
  let totalMeetingMs = 0;
  const meetingsByDay: Record<string, number> = {};

  for (const event of events) {
    if (!event.start || !event.end) continue;
    const startMs = new Date(event.start).getTime();
    const endMs = new Date(event.end).getTime();
    const durationMs = Math.max(0, endMs - startMs);
    totalMeetingMs += durationMs;

    const dayKey = toDateLabel(event.start);
    meetingsByDay[dayKey] = (meetingsByDay[dayKey] ?? 0) + durationMs / (1000 * 60 * 60);
  }

  // Total business hours in range: 8h per working day (Mon-Fri)
  let businessHours = 0;
  const cursor = new Date(startDate);
  while (cursor <= now) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) businessHours += 8;
    cursor.setDate(cursor.getDate() + 1);
  }

  const meetingHours = parseFloat((totalMeetingMs / (1000 * 60 * 60)).toFixed(1));
  const focusHours = parseFloat(Math.max(0, businessHours - meetingHours).toFixed(1));
  const totalHours = businessHours;

  const meetingPercent =
    totalHours > 0 ? Math.round((meetingHours / totalHours) * 100) : 0;
  const focusPercent =
    totalHours > 0 ? Math.round((focusHours / totalHours) * 100) : 0;

  // Busiest day = day with most meeting hours
  let busiestDay = "N/A";
  let maxHours = 0;
  for (const [day, hours] of Object.entries(meetingsByDay)) {
    if (hours > maxHours) {
      maxHours = hours;
      busiestDay = day;
    }
  }

  const message = `${meetingHours}h in meetings (${meetingPercent}%), ${focusHours}h focus time (${focusPercent}%)`;

  return {
    totalHours,
    meetingHours,
    focusHours,
    meetingPercent,
    focusPercent,
    busiestDay,
    meetingsByDay: Object.fromEntries(
      Object.entries(meetingsByDay).map(([k, v]) => [k, parseFloat(v.toFixed(1))]),
    ),
    message,
  };
}
