import { describe, it, expect } from "vitest";
import { classifyMarketerRequest } from "./marketer.js";

describe("classifyMarketerRequest", () => {
  it("detects generate post intent", () => {
    const cls = classifyMarketerRequest("Create a post about AI automation");
    expect(cls.isGeneratePost).toBe(true);
  });

  it("detects generate image intent", () => {
    const cls = classifyMarketerRequest("Generate an image for our banner");
    expect(cls.isGenerateImage).toBe(true);
  });

  it("detects edit image intent", () => {
    const cls = classifyMarketerRequest("Edit the image to add text overlay");
    expect(cls.isEditImage).toBe(true);
  });

  it("detects schedule post intent", () => {
    const cls = classifyMarketerRequest("Schedule this post for tomorrow");
    expect(cls.isSchedulePost).toBe(true);
  });

  it("detects publish post intent", () => {
    const cls = classifyMarketerRequest("Publish this to Instagram now");
    expect(cls.isPublishPost).toBe(true);
  });

  it("detects analytics intent", () => {
    const cls = classifyMarketerRequest("Show me my post analytics");
    expect(cls.isFetchAnalytics).toBe(true);
  });

  it("detects performance analysis intent", () => {
    const cls = classifyMarketerRequest("Analyze why my top posts worked");
    expect(cls.isAnalyzePerformance).toBe(true);
  });

  it("detects content calendar intent", () => {
    const cls = classifyMarketerRequest("Create a weekly content plan");
    expect(cls.isContentCalendar).toBe(true);
  });

  it("detects brand mentions intent", () => {
    const cls = classifyMarketerRequest("Monitor brand mentions for us");
    expect(cls.isBrandMentions).toBe(true);
  });

  it("detects competitor analysis intent", () => {
    const cls = classifyMarketerRequest("Analyze our competitor's social profile");
    expect(cls.isCompetitorAnalysis).toBe(true);
  });

  it("detects trending topics intent", () => {
    const cls = classifyMarketerRequest("What's trending in tech right now?");
    expect(cls.isTrendingTopics).toBe(true);
  });

  it("detects content library intent", () => {
    const cls = classifyMarketerRequest("Search the content library for past posts");
    expect(cls.isContentLibrary).toBe(true);
  });

  it("returns all false for unrelated input", () => {
    const cls = classifyMarketerRequest("Hello, how are you today?");
    expect(Object.values(cls).every((v) => v === false)).toBe(true);
  });
});
