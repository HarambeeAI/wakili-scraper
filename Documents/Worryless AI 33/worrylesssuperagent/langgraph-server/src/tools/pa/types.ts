// Personal Assistant tool type contracts

export interface PAClassification {
  isReadEmails: boolean;
  isTriageInbox: boolean;
  isDraftEmail: boolean;
  isSendEmail: boolean;
  isListCalendar: boolean;
  isCreateEvent: boolean;
  isMeetingBrief: boolean;
  isSearchDrive: boolean;
  isDetectConflicts: boolean;
  isTimeAllocation: boolean;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to?: string;
  date: string;
  snippet: string;
  labelIds: string[];
  body?: string;
}

export interface TriagedEmail {
  id: string;
  subject: string;
  from: string;
  urgency: "urgent" | "high" | "normal" | "low";
  topic: string;
  suggestedAction: "respond" | "delegate" | "archive" | "follow_up";
  reason: string;
}

export interface DraftedEmail {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  attendees: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  htmlLink: string | null;
}

export interface CreateEventInput {
  summary: string;
  startTime: string;
  endTime: string;
  attendees?: string[];
  description?: string;
  location?: string;
}

export interface BusySlot {
  start: string;
  end: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  busySlots: BusySlot[];
  suggestions?: string[];
}

export interface MeetingBrief {
  eventSummary: string;
  attendees: Array<{ email: string; name?: string; recentEmails?: string[] }>;
  agenda: string | null;
  relatedDocs: Array<{ title: string; url: string }>;
  briefing: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
  size?: string;
}

export interface TimeAllocation {
  totalHours: number;
  meetingHours: number;
  focusHours: number;
  meetingPercent: number;
  focusPercent: number;
  busiestDay: string;
  meetingsByDay: Record<string, number>;
}
