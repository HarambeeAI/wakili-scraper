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

import { createContract, listContracts, reviewContract } from "./contract-tools.js";
import { contractCalendar } from "./compliance-tools.js";

describe("createContract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts a contract and returns contractId + message", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "contract-abc" }] });

    const result = await createContract(
      "user-1",
      "Service Agreement",
      "Acme Corp",
    );

    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO public.contracts");
    expect(params[0]).toBe("user-1");
    expect(params[1]).toBe("Service Agreement");
    expect(params[2]).toBe("Acme Corp");

    expect(result.contractId).toBe("contract-abc");
    expect(result.message).toContain("Service Agreement");
    expect(result.message).toContain("Acme Corp");
  });
});

describe("listContracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns contracts for a user", async () => {
    const fakeContracts = [
      { id: "c1", title: "NDA", status: "active" },
      { id: "c2", title: "MSA", status: "draft" },
    ];
    mockQuery.mockResolvedValueOnce({ rows: fakeContracts });

    const result = await listContracts("user-1");

    expect(result.contracts).toHaveLength(2);
    expect(result.count).toBe(2);
  });

  it("returns empty message when no contracts found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await listContracts("user-1");

    expect(result.message).toBe("No contracts on file.");
  });

  it("filters by status when provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listContracts("user-1", "active");

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("status = $2");
    expect(params[1]).toBe("active");
  });
});

describe("reviewContract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls LLM with structured output and updates DB", async () => {
    mockCallLLMWithStructuredOutput.mockResolvedValueOnce({
      data: {
        riskFlags: [
          { severity: "high", description: "Unlimited liability clause", clause: "Section 5" },
        ],
        keyTerms: {
          parties: "Acme and Widget Co",
          payment: "Net 30",
          termination: "30 days notice",
          ip: "Work for hire",
          liability: "Unlimited",
        },
        recommendation: "Negotiate liability cap before signing.",
      },
      tokensUsed: 200,
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await reviewContract("user-1", "contract-1", "Contract text here...");

    expect(mockCallLLMWithStructuredOutput).toHaveBeenCalledOnce();
    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("UPDATE public.contracts");

    expect(result.contractId).toBe("contract-1");
    expect(result.riskFlags).toHaveLength(1);
    expect(result.riskFlags[0].severity).toBe("high");
    expect(result.recommendation).toContain("1 risk flag(s) identified");
  });

  it("reports no risks when LLM returns empty riskFlags", async () => {
    mockCallLLMWithStructuredOutput.mockResolvedValueOnce({
      data: {
        riskFlags: [],
        keyTerms: { parties: "A and B", payment: "Net 60", termination: "60 days", ip: "N/A", liability: "Limited" },
        recommendation: "Looks clean.",
      },
      tokensUsed: 100,
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await reviewContract("user-1", "contract-2", "Clean contract...");

    expect(result.riskFlags).toHaveLength(0);
    expect(result.recommendation).toContain("No risk flags identified");
  });
});

describe("contractCalendar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns upcoming renewals", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);
    const futureDateStr = futureDate.toISOString();

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "c1",
          title: "Vendor NDA",
          counterparty: "Supplier Co",
          renewal_date: futureDateStr,
          value: 5000,
        },
      ],
    });

    const result = await contractCalendar("user-1", 60);

    expect(result.renewals).toHaveLength(1);
    expect(result.renewals[0].contractId).toBe("c1");
    expect(result.renewals[0].daysUntilRenewal).toBeGreaterThan(0);
    expect(result.message).toContain("1 contract(s)");
  });

  it("returns empty message when no renewals due", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await contractCalendar("user-1", 30);

    expect(result.renewals).toHaveLength(0);
    expect(result.message).toContain("No contract renewals due");
    expect(result.message).toContain("30 days");
  });
});
