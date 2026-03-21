import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import {
  extractJson,
  filterRecommendations,
} from "../routes/spawnAgentTeam.js";

// Mock pool
vi.mock("../db/pool.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

// Mock getGeminiOpenAI
const mockCreate = vi.fn();
vi.mock("../lib/gemini.js", () => ({
  getGeminiOpenAI: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
}));

// Mock auth middleware to inject fake user
vi.mock("../middleware/auth.js", () => ({
  verifyLogtoJWT: vi.fn((_req: any, _res: any, next: any) => {
    _req.auth = { userId: "test-user-123", payload: {} };
    next();
  }),
}));

import { pool } from "../db/pool.js";
import { app } from "../index.js";

describe("extractJson", () => {
  it("strips markdown code fences from JSON", () => {
    const raw = '```json\n{"recommendations": []}\n```';
    expect(extractJson(raw)).toBe('{"recommendations": []}');
  });

  it("returns plain JSON untouched", () => {
    expect(extractJson('{"key": "value"}')).toBe('{"key": "value"}');
  });
});

describe("filterRecommendations", () => {
  const validIds = new Set(["hr", "legal", "data_analyst"]);
  const defaultIds = new Set(["chief_of_staff", "accountant"]);

  it("filters to only valid non-default IDs", () => {
    const parsed = {
      recommendations: [
        { agent_type_id: "hr", reasoning: "R", first_week_value: "V" },
        {
          agent_type_id: "chief_of_staff",
          reasoning: "R",
          first_week_value: "V",
        },
        { agent_type_id: "unknown_id", reasoning: "R", first_week_value: "V" },
      ],
    };
    const result = filterRecommendations(parsed, validIds, defaultIds);
    expect(result).toHaveLength(1);
    expect(result[0].agent_type_id).toBe("hr");
  });

  it("returns empty array for non-object input", () => {
    expect(filterRecommendations(null, validIds, defaultIds)).toEqual([]);
  });

  it("limits to 5 recommendations", () => {
    const parsed = {
      recommendations: Array.from({ length: 10 }, (_, i) => ({
        agent_type_id: i < 3 ? ["hr", "legal", "data_analyst"][i] : "hr",
        reasoning: "R",
        first_week_value: "V",
      })),
    };
    const allValid = new Set(
      Array.from({ length: 10 }, () => "hr").concat(["legal", "data_analyst"]),
    );
    const result = filterRecommendations(parsed, allValid, new Set());
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

describe("POST /api/spawn-agent-team", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with recommendations and allAgents on valid request", async () => {
    // Mock catalog query
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rows: [
        {
          id: "chief_of_staff",
          display_name: "Chief of Staff",
          description: "CoS",
          skill_config: [],
        },
        {
          id: "hr",
          display_name: "HR Manager",
          description: "HR",
          skill_config: ["hr"],
        },
        {
          id: "legal",
          display_name: "Legal Advisor",
          description: "Legal",
          skill_config: ["legal"],
        },
      ],
    });

    // Mock LLM response
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              recommendations: [
                {
                  agent_type_id: "hr",
                  reasoning: "HR helps with hiring",
                  first_week_value: "Set up hiring pipeline",
                },
              ],
            }),
          },
        },
      ],
    });

    const res = await request(app).post("/api/spawn-agent-team").send({
      businessName: "Acme",
      industry: "Tech",
      description: "SaaS",
      location: "US",
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("recommendations");
    expect(res.body).toHaveProperty("allAgents");
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(Array.isArray(res.body.allAgents)).toBe(true);
    expect(res.body.allAgents).toHaveLength(3);
    expect(res.body.recommendations).toHaveLength(1);
    expect(res.body.recommendations[0].agent_type_id).toBe("hr");
  });

  it("returns empty recommendations when catalog is empty", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rows: [],
    });

    const res = await request(app)
      .post("/api/spawn-agent-team")
      .send({ businessName: "Test" });

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toEqual([]);
    expect(res.body.allAgents).toEqual([]);
  });

  it("returns empty recommendations when LLM fails", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rows: [
        { id: "hr", display_name: "HR", description: "HR", skill_config: [] },
      ],
    });

    mockCreate.mockRejectedValueOnce(new Error("LLM down"));

    const res = await request(app)
      .post("/api/spawn-agent-team")
      .send({ businessName: "Test" });

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toEqual([]);
    expect(res.body.allAgents).toHaveLength(1);
  });
});
