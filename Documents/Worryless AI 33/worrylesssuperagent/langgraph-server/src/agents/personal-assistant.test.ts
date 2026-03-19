import { describe, it, expect } from "vitest";
import { classifyPARequest } from "./personal-assistant.js";

describe("classifyPARequest", () => {
  it("detects read emails intent", () => {
    expect(classifyPARequest("Check my email inbox").isReadEmails).toBe(true);
  });
  it("detects triage inbox intent", () => {
    expect(classifyPARequest("Triage my inbox by urgency").isTriageInbox).toBe(true);
  });
  it("detects draft email intent", () => {
    expect(classifyPARequest("Draft a reply to that email").isDraftEmail).toBe(true);
  });
  it("detects send email intent", () => {
    expect(classifyPARequest("Send that email now").isSendEmail).toBe(true);
  });
  it("detects list calendar intent", () => {
    expect(classifyPARequest("What meetings do I have today?").isListCalendar).toBe(true);
  });
  it("detects create event intent", () => {
    expect(classifyPARequest("Schedule a meeting with John at 2pm").isCreateEvent).toBe(true);
  });
  it("detects meeting brief intent", () => {
    expect(classifyPARequest("Prepare a brief for my 3pm meeting").isMeetingBrief).toBe(true);
  });
  it("detects search drive intent", () => {
    expect(classifyPARequest("Find the project proposal document").isSearchDrive).toBe(true);
  });
  it("detects conflict detection intent", () => {
    expect(classifyPARequest("Do I have any schedule conflicts?").isDetectConflicts).toBe(true);
  });
  it("detects time allocation intent", () => {
    expect(classifyPARequest("How much time have I spent in meetings this week?").isTimeAllocation).toBe(true);
  });
  it("returns all false for unrelated input", () => {
    const cls = classifyPARequest("Hello, how are you?");
    expect(Object.values(cls).every((v) => v === false)).toBe(true);
  });
});
