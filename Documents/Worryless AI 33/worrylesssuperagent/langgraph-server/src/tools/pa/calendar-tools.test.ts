import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures these are available inside vi.mock factories
const { mockEventsList, mockEventsInsert, mockEventsGet, mockFreebusyQuery, mockGoogleClient, mockCallLLM, mockInterrupt } =
  vi.hoisted(() => {
    const mockEventsList = vi.fn();
    const mockEventsInsert = vi.fn();
    const mockEventsGet = vi.fn();
    const mockFreebusyQuery = vi.fn();
    const mockGoogleClient = vi.fn().mockResolvedValue({});
    const mockCallLLM = vi.fn().mockResolvedValue({
      content: "Suggestion 1\nSuggestion 2",
      tokensUsed: 50,
    });
    const mockInterrupt = vi.fn().mockReturnValue({ approved: true });

    return {
      mockEventsList,
      mockEventsInsert,
      mockEventsGet,
      mockFreebusyQuery,
      mockGoogleClient,
      mockCallLLM,
      mockInterrupt,
    };
  });

// Mock googleapis — Calendar API
vi.mock("googleapis", () => {
  const calendarInstance = {
    events: {
      list: mockEventsList,
      insert: mockEventsInsert,
      get: mockEventsGet,
    },
    freebusy: {
      query: mockFreebusyQuery,
    },
  };
  return {
    google: {
      calendar: vi.fn(() => calendarInstance),
    },
  };
});

// Mock google-auth
vi.mock("./google-auth.js", () => ({
  getGoogleClient: mockGoogleClient,
}));

// Mock LLM client
vi.mock("../../llm/client.js", () => ({
  callLLM: mockCallLLM,
  callLLMWithStructuredOutput: vi.fn(),
}));

// Mock HITL interrupt handler
vi.mock("../../hitl/interrupt-handler.js", () => ({
  interruptForApproval: mockInterrupt,
}));

import {
  listCalendarEvents,
  createCalendarEvent,
  detectCalendarConflicts,
  analyzeTimeAllocation,
} from "./calendar-tools.js";

// Sample calendar events
const MOCK_EVENT_1 = {
  id: "evt-001",
  summary: "Team standup",
  description: "Daily sync",
  location: null,
  start: { dateTime: "2026-03-19T09:00:00Z" },
  end: { dateTime: "2026-03-19T09:30:00Z" },
  attendees: [
    { email: "alice@example.com", displayName: "Alice", responseStatus: "accepted" },
  ],
  htmlLink: "https://calendar.google.com/event/evt-001",
};

const MOCK_EVENT_2 = {
  id: "evt-002",
  summary: "Product review",
  description: "Q1 product review",
  location: "Conference Room A",
  start: { dateTime: "2026-03-19T14:00:00Z" },
  end: { dateTime: "2026-03-19T15:00:00Z" },
  attendees: [],
  htmlLink: "https://calendar.google.com/event/evt-002",
};

describe("calendar-tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoogleClient.mockResolvedValue({});
    mockCallLLM.mockResolvedValue({ content: "Suggestion 1\nSuggestion 2", tokensUsed: 50 });
    mockInterrupt.mockReturnValue({ approved: true });
  });

  // PA-05
  describe("listCalendarEvents", () => {
    it("returns filtered events with attendees mapped", async () => {
      mockEventsList.mockResolvedValueOnce({
        data: { items: [MOCK_EVENT_1, MOCK_EVENT_2] },
      });

      const result = await listCalendarEvents("user-1");

      expect(result.count).toBe(2);
      expect(result.events).toHaveLength(2);
      expect(result.events[0].id).toBe("evt-001");
      expect(result.events[0].summary).toBe("Team standup");
      expect(result.events[0].start).toBe("2026-03-19T09:00:00Z");
      expect(result.events[0].attendees[0].email).toBe("alice@example.com");
    });

    it("returns empty message when no events in range", async () => {
      mockEventsList.mockResolvedValueOnce({ data: { items: [] } });

      const result = await listCalendarEvents("user-1", "2026-03-19T00:00:00Z", "2026-03-19T23:59:59Z");

      expect(result.count).toBe(0);
      expect(result.events).toHaveLength(0);
      expect(result.message).toContain("No events found");
    });
  });

  // PA-06
  describe("createCalendarEvent", () => {
    const eventInput = {
      summary: "Project kickoff",
      startTime: "2026-03-20T10:00:00Z",
      endTime: "2026-03-20T11:00:00Z",
      attendees: ["alice@example.com"],
      description: "Q2 project kickoff meeting",
    };

    it("checks freeBusy and calls HITL before inserting", async () => {
      // No conflicts
      mockFreebusyQuery.mockResolvedValueOnce({
        data: { calendars: { primary: { busy: [] } } },
      });
      mockInterrupt.mockReturnValueOnce({ approved: true });
      mockEventsInsert.mockResolvedValueOnce({
        data: { id: "new-evt-001", htmlLink: "https://calendar.google.com/new-evt-001" },
      });

      const result = await createCalendarEvent("user-1", "personal_assistant", eventInput);

      expect(mockFreebusyQuery).toHaveBeenCalledOnce();
      expect(mockInterrupt).toHaveBeenCalledOnce();
      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "create_calendar_event",
          agentType: "personal_assistant",
        }),
      );
      expect(mockEventsInsert).toHaveBeenCalledOnce();
      expect(result.created).toBe(true);
      expect(result.eventId).toBe("new-evt-001");
      expect(result.message).toBe("Calendar event created.");
    });

    it("returns conflict when freeBusy shows busy slots", async () => {
      mockFreebusyQuery.mockResolvedValueOnce({
        data: {
          calendars: {
            primary: {
              busy: [
                { start: "2026-03-20T10:00:00Z", end: "2026-03-20T10:30:00Z" },
              ],
            },
          },
        },
      });

      const result = await createCalendarEvent("user-1", "personal_assistant", eventInput);

      expect(result.created).toBe(false);
      expect(result.conflict).toBe(true);
      expect(result.busySlots).toHaveLength(1);
      expect(result.message).toContain("Conflict detected");
      expect(result.message).toContain("1 event(s)");
      // Should NOT call HITL or insert if conflict detected
      expect(mockInterrupt).not.toHaveBeenCalled();
      expect(mockEventsInsert).not.toHaveBeenCalled();
    });

    it("returns cancelled when HITL not approved", async () => {
      mockFreebusyQuery.mockResolvedValueOnce({
        data: { calendars: { primary: { busy: [] } } },
      });
      mockInterrupt.mockReturnValueOnce({ approved: false });

      const result = await createCalendarEvent("user-1", "personal_assistant", eventInput);

      expect(result.created).toBe(false);
      expect(result.message).toBe("Event creation cancelled by user.");
      expect(mockEventsInsert).not.toHaveBeenCalled();
    });
  });

  // PA-09
  describe("detectCalendarConflicts", () => {
    it("finds overlapping events and returns conflict result with suggestions", async () => {
      // Two overlapping events: first ends at 09:30, second starts at 09:15
      const overlappingEvent1 = {
        ...MOCK_EVENT_1,
        start: { dateTime: "2026-03-19T09:00:00Z" },
        end: { dateTime: "2026-03-19T09:30:00Z" },
      };
      const overlappingEvent2 = {
        ...MOCK_EVENT_2,
        start: { dateTime: "2026-03-19T09:15:00Z" },
        end: { dateTime: "2026-03-19T10:00:00Z" },
      };

      mockEventsList.mockResolvedValueOnce({
        data: { items: [overlappingEvent1, overlappingEvent2] },
      });

      mockCallLLM.mockResolvedValueOnce({
        content: "1. Reschedule one meeting\n2. Shorten standup to 15 minutes",
        tokensUsed: 80,
      });

      const result = await detectCalendarConflicts("user-1", "2026-03-19");

      expect(result.hasConflict).toBe(true);
      expect(result.busySlots.length).toBeGreaterThan(0);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });

    it("returns no conflict when events do not overlap", async () => {
      mockEventsList.mockResolvedValueOnce({
        data: { items: [MOCK_EVENT_1, MOCK_EVENT_2] },
      });

      const result = await detectCalendarConflicts("user-1", "2026-03-19");

      expect(result.hasConflict).toBe(false);
      expect(result.busySlots).toHaveLength(0);
    });

    it("returns no conflict when calendar is empty", async () => {
      mockEventsList.mockResolvedValueOnce({ data: { items: [] } });

      const result = await detectCalendarConflicts("user-1", "2026-03-19");

      expect(result.hasConflict).toBe(false);
      expect(result.busySlots).toHaveLength(0);
    });
  });

  // PA-10
  describe("analyzeTimeAllocation", () => {
    it("returns meeting/focus time breakdown", async () => {
      // 2 events: 30min standup + 60min product review = 1.5h meetings
      mockEventsList.mockResolvedValueOnce({
        data: { items: [MOCK_EVENT_1, MOCK_EVENT_2] },
      });

      const result = await analyzeTimeAllocation("user-1", 5);

      expect(result.meetingHours).toBe(1.5);
      expect(result.totalHours).toBeGreaterThan(0);
      expect(result.focusHours).toBeGreaterThanOrEqual(0);
      expect(result.meetingPercent).toBeGreaterThanOrEqual(0);
      expect(result.focusPercent).toBeGreaterThanOrEqual(0);
      expect(result.meetingPercent + result.focusPercent).toBeLessThanOrEqual(100);
      expect(result.message).toContain("1.5h in meetings");
      expect(result.message).toContain("focus time");
    });

    it("returns zero meetings when calendar is empty", async () => {
      mockEventsList.mockResolvedValueOnce({ data: { items: [] } });

      const result = await analyzeTimeAllocation("user-1", 7);

      expect(result.meetingHours).toBe(0);
      expect(result.meetingPercent).toBe(0);
      expect(result.busiestDay).toBe("N/A");
    });
  });
});
