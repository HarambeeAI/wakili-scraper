import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock references
const { mockQuery, mockGetPool, mockCallLLM, mockCallLLMWithStructuredOutput } =
  vi.hoisted(() => {
    const mockQuery = vi.fn();
    const mockGetPool = vi.fn(() => ({ query: mockQuery }));
    const mockCallLLM = vi.fn();
    const mockCallLLMWithStructuredOutput = vi.fn();
    return { mockQuery, mockGetPool, mockCallLLM, mockCallLLMWithStructuredOutput };
  });

vi.mock("../shared/db.js", () => ({ getPool: mockGetPool }));
vi.mock("../../llm/client.js", () => ({
  callLLM: mockCallLLM,
  callLLMWithStructuredOutput: mockCallLLMWithStructuredOutput,
}));

import {
  trackCandidate,
  screenResume,
  listCandidates,
} from "./recruiting-tools.js";

describe("trackCandidate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts a candidate and returns candidateId + message", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "cand-123" }] });

    const result = await trackCandidate(
      "user-1",
      "Jane Smith",
      "jane@example.com",
      "Software Engineer",
    );

    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO public.candidates");
    expect(params[0]).toBe("user-1");
    expect(params[1]).toBe("Jane Smith");
    expect(params[3]).toBe("Software Engineer");

    expect(result.candidateId).toBe("cand-123");
    expect(result.message).toContain("Jane Smith");
    expect(result.message).toContain("Software Engineer");
  });

  it("accepts undefined email", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "cand-456" }] });

    const result = await trackCandidate(
      "user-1",
      "John Doe",
      undefined,
      "Designer",
    );

    const [, params] = mockQuery.mock.calls[0];
    expect(params[2]).toBeNull(); // email should be null
    expect(result.candidateId).toBe("cand-456");
  });
});

describe("screenResume", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls LLM with structured output, updates DB, and returns screening result", async () => {
    mockCallLLMWithStructuredOutput.mockResolvedValueOnce({
      data: {
        skillsScore: 85,
        experienceScore: 78,
        cultureScore: 90,
        overallScore: 84,
        strengths: ["Strong TypeScript skills", "Team player"],
        gaps: ["Limited backend experience"],
        recommendation: "Recommend for interview.",
      },
      tokensUsed: 150,
    });
    // First query: UPDATE candidates
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // Second query: SELECT name
    mockQuery.mockResolvedValueOnce({ rows: [{ name: "Jane Smith" }] });

    const result = await screenResume(
      "user-1",
      "cand-123",
      "Jane Smith, 5 years TypeScript...",
      "Frontend Engineer",
    );

    expect(mockCallLLMWithStructuredOutput).toHaveBeenCalledOnce();
    expect(mockQuery).toHaveBeenCalledTimes(2);

    const [updateSql] = mockQuery.mock.calls[0];
    expect(updateSql).toContain("UPDATE public.candidates");

    expect(result.skillsScore).toBe(85);
    expect(result.experienceScore).toBe(78);
    expect(result.cultureScore).toBe(90);
    expect(result.overallScore).toBe(84);
    expect(result.recommendation).toContain("84/100");
    expect(result.recommendation).toContain("Skills: 85");
  });
});

describe("listCandidates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns candidates for a user", async () => {
    const fakeCandidates = [
      { id: "c1", name: "Alice", overall_score: 90 },
      { id: "c2", name: "Bob", overall_score: 75 },
    ];
    mockQuery.mockResolvedValueOnce({ rows: fakeCandidates });

    const result = await listCandidates("user-1");

    expect(result.candidates).toHaveLength(2);
    expect(result.count).toBe(2);
  });

  it("returns empty message for position when no candidates found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await listCandidates("user-1", "Designer");

    expect(result.message).toBe('No candidates found for "Designer".');
  });

  it("filters by position when provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listCandidates("user-1", "Engineer");

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("position = $2");
    expect(params[1]).toBe("Engineer");
  });

  it("filters by status when provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listCandidates("user-1", undefined, "screened");

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("status = $2");
    expect(params[1]).toBe("screened");
  });
});
