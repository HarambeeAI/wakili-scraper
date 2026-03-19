// Barrel export for all Personal Assistant tools

// Email tools (PA-01, PA-02, PA-03, PA-04)
export { readEmails, triageInbox, draftEmailResponse, sendEmail } from "./email-tools.js";

// Calendar tools (PA-05, PA-06, PA-09, PA-10)
export { listCalendarEvents, createCalendarEvent, detectCalendarConflicts, analyzeTimeAllocation } from "./calendar-tools.js";

// Meeting tools (PA-07)
export { prepareMeetingBrief } from "./meeting-tools.js";

// Drive tools (PA-08)
export { searchDrive } from "./drive-tools.js";

// Google auth
export { getGoogleClient } from "./google-auth.js";

// Type re-exports
export type {
  PAClassification,
  EmailMessage,
  TriagedEmail,
  DraftedEmail,
  CalendarEvent,
  CreateEventInput,
  BusySlot,
  ConflictResult,
  MeetingBrief,
  DriveFile,
  TimeAllocation,
} from "./types.js";
