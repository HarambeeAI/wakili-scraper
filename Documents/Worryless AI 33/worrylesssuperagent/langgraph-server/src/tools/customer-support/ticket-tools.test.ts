import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mock references (vi.hoisted avoids TDZ issue with vi.mock factory) ---
const { mockQuery, mockGetPool, mockRagRetrieveByText, mockCallLLM } =
  vi.hoisted(() => {
    const mockQuery = vi.fn();
    const mockGetPool = vi.fn(() => ({ query: mockQuery }));
    const mockRagRetrieveByText = vi.fn();
    const mockCallLLM = vi.fn();
    return { mockQuery, mockGetPool, mockRagRetrieveByText, mockCallLLM };
  });

vi.mock("../shared/db.js", () => ({ getPool: mockGetPool }));
vi.mock("../rag-retrieval.js", () => ({
  ragRetrieveByText: mockRagRetrieveByText,
}));
vi.mock("../../llm/client.js", () => ({ callLLM: mockCallLLM }));

import {
  createTicket,
  listTickets,
  updateTicket,
  searchKBAndDraftResponse,
} from "./ticket-tools.js";

describe("createTicket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a ticket and returns ticketId + message", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "ticket-123" }] });

    const result = await createTicket({
      userId: "user-1",
      customerName: "Acme Corp",
      subject: "Login broken",
      priority: "high",
    });

    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO public.support_tickets");
    expect(params[0]).toBe("user-1");
    expect(params[1]).toBe("Acme Corp");
    expect(params[3]).toBe("Login broken");

    expect(result.ticketId).toBe("ticket-123");
    expect(result.message).toContain("#ticket-123");
    expect(result.message).toContain("Login broken");
  });
});

describe("listTickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tickets for a user", async () => {
    const fakeTickets = [
      { id: "t1", subject: "Issue 1", status: "open" },
      { id: "t2", subject: "Issue 2", status: "resolved" },
    ];
    mockQuery.mockResolvedValueOnce({ rows: fakeTickets });

    const result = await listTickets("user-1");

    expect(result.tickets).toHaveLength(2);
    expect(result.count).toBe(2);
  });

  it("returns empty message when no tickets found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await listTickets("user-1");

    expect(result.tickets).toHaveLength(0);
    expect(result.message).toBe("No support tickets found.");
  });

  it("filters by status when provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await listTickets("user-1", "open");

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("status = $2");
    expect(params[1]).toBe("open");
  });
});

describe("updateTicket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets resolved_at when status is resolved", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await updateTicket("user-1", "ticket-123", {
      status: "resolved",
    });

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("resolved_at = now()");
    expect(result.message).toContain("marked as resolved");
  });

  it("does not set resolved_at for non-resolved status", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await updateTicket("user-1", "ticket-123", {
      status: "in_progress",
    });

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).not.toContain("resolved_at = now()");
    expect(result.updated).toBe(true);
  });
});

describe("searchKBAndDraftResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls RAG then LLM and returns draft response", async () => {
    mockRagRetrieveByText.mockResolvedValueOnce([
      {
        id: "doc-1",
        content: "Reset password via /settings",
        source: "help-center",
        similarity: 0.9,
        metadata: {},
      },
    ]);
    mockCallLLM.mockResolvedValueOnce({
      content: "Here is how to reset your password...",
      tokensUsed: 100,
    });

    const result = await searchKBAndDraftResponse(
      "user-1",
      "How do I reset my password?",
    );

    expect(mockRagRetrieveByText).toHaveBeenCalledWith(
      "user-1",
      "How do I reset my password?",
      5,
      "customer_support",
    );
    expect(mockCallLLM).toHaveBeenCalledOnce();
    expect(result.kbResults).toHaveLength(1);
    expect(result.draftResponse).toContain("reset");
    expect(result.message).toContain("1 knowledge base article(s)");
  });

  it("returns empty message when no KB results found", async () => {
    mockRagRetrieveByText.mockResolvedValueOnce([]);

    const result = await searchKBAndDraftResponse("user-1", "obscure query");

    expect(mockCallLLM).not.toHaveBeenCalled();
    expect(result.draftResponse).toBeNull();
    expect(result.message).toContain("No knowledge base articles found");
  });
});
