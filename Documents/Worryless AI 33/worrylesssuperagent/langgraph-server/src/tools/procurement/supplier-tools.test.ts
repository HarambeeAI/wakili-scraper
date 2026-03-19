import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures these are available inside vi.mock factories (which are hoisted)
const { mockCallLLMStructured, mockFetch, mockPool, mockInterrupt } =
  vi.hoisted(() => {
    const mockPool = {
      query: vi.fn(),
    };

    const mockCallLLMStructured = vi.fn().mockResolvedValue({
      data: { suppliers: [] },
      tokensUsed: 0,
    });

    const mockFetch = vi.fn();

    const mockInterrupt = vi.fn().mockReturnValue({ approved: false });

    return { mockCallLLMStructured, mockFetch, mockPool, mockInterrupt };
  });

// Install fetch mock globally
global.fetch = mockFetch;

vi.mock("../../llm/client.js", () => ({
  callLLMWithStructuredOutput: mockCallLLMStructured,
}));

vi.mock("../shared/db.js", () => ({
  getPool: () => mockPool,
}));

vi.mock("../../hitl/interrupt-handler.js", () => ({
  interruptForApproval: mockInterrupt,
}));

// Import after mocks
import { searchSuppliers, compareQuotes, scoreVendor } from "./supplier-tools.js";
import { createPurchaseOrder } from "./po-tools.js";

describe("procurement/supplier-tools", () => {
  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = "test-key";
    mockFetch.mockReset();
    mockCallLLMStructured.mockClear();
    mockPool.query.mockReset();
    mockInterrupt.mockReset();
  });

  // ── searchSuppliers ───────────────────────────────────────────

  describe("searchSuppliers", () => {
    it("returns empty with message when FIRECRAWL_API_KEY missing", async () => {
      delete process.env.FIRECRAWL_API_KEY;

      const result = await searchSuppliers("user-1", "office furniture");

      expect(result.suppliers).toEqual([]);
      expect(result.message).toContain("No suppliers found");
      expect(result.message).toContain("office furniture");
    });

    it("calls Firecrawl and extracts structured supplier info via LLM", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                url: "https://acmesupply.com",
                title: "Acme Supply Co",
                description: "Industrial equipment supplier based in Chicago",
              },
            ],
          }),
      });

      mockCallLLMStructured.mockResolvedValueOnce({
        data: {
          suppliers: [
            {
              name: "Acme Supply Co",
              website: "https://acmesupply.com",
              description: "Industrial equipment supplier",
              location: "Chicago, IL",
              capabilities: ["industrial equipment", "bulk orders", "B2B"],
            },
          ],
        },
        tokensUsed: 100,
      });

      const result = await searchSuppliers("user-1", "industrial equipment");

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockCallLLMStructured).toHaveBeenCalledOnce();
      expect(result.suppliers.length).toBe(1);
      expect(result.suppliers[0].name).toBe("Acme Supply Co");
      expect(result.message).toContain("Found 1 potential supplier(s)");
    });

    it("returns empty with message when Firecrawl returns no results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const result = await searchSuppliers("user-1", "rare minerals");

      expect(result.suppliers).toEqual([]);
      expect(result.message).toContain("No suppliers found");
    });
  });

  // ── compareQuotes ─────────────────────────────────────────────

  describe("compareQuotes", () => {
    it("scores suppliers and returns bestValue correctly", async () => {
      const suppliers = [
        { name: "Supplier A", price: 1000, terms: "Net 30", quality: 90, leadTime: "5 days" },
        { name: "Supplier B", price: 800, terms: "Net 15", quality: 75, leadTime: "10 days" },
        { name: "Supplier C", price: 1200, terms: "Net 60", quality: 95, leadTime: "3 days" },
      ];

      const result = await compareQuotes("user-1", suppliers);

      expect(result.suppliers.length).toBe(3);
      expect(result.bestValue).toBeTruthy();
      expect(result.recommendation).toContain("3 supplier(s) compared");
      expect(result.recommendation).toContain("Best value:");

      // Verify all suppliers are scored
      for (const s of result.suppliers) {
        expect(s.totalScore).toBeGreaterThanOrEqual(0);
        expect(s.totalScore).toBeLessThanOrEqual(100);
      }
    });

    it("returns empty comparison for empty supplier list", async () => {
      const result = await compareQuotes("user-1", []);

      expect(result.suppliers).toEqual([]);
      expect(result.bestValue).toBe("N/A");
    });

    it("gives lower price higher score", async () => {
      const suppliers = [
        { name: "Cheap", price: 100, terms: "Net 30", quality: 80, leadTime: "7 days" },
        { name: "Expensive", price: 1000, terms: "Net 30", quality: 80, leadTime: "7 days" },
      ];

      const result = await compareQuotes("user-1", suppliers);
      const cheapScore = result.suppliers.find((s) => s.name === "Cheap")!.totalScore;
      const expensiveScore = result.suppliers.find((s) => s.name === "Expensive")!.totalScore;

      expect(cheapScore).toBeGreaterThan(expensiveScore);
    });

    it("parses week and month lead times correctly", async () => {
      const suppliers = [
        { name: "Fast", price: 500, terms: "Net 30", quality: 80, leadTime: "1 week" },
        { name: "Slow", price: 500, terms: "Net 30", quality: 80, leadTime: "1 month" },
      ];

      const result = await compareQuotes("user-1", suppliers);
      const fastScore = result.suppliers.find((s) => s.name === "Fast")!.totalScore;
      const slowScore = result.suppliers.find((s) => s.name === "Slow")!.totalScore;

      // Fast (7 days) should score higher than slow (30 days) on lead time
      expect(fastScore).toBeGreaterThan(slowScore);
    });
  });
});

// ── po-tools ──────────────────────────────────────────────────────

describe("procurement/po-tools", () => {
  beforeEach(() => {
    mockPool.query.mockReset();
    mockInterrupt.mockReset();
  });

  const sampleInput = {
    userId: "user-1",
    supplier: "Acme Supply Co",
    itemDescription: "Office Chairs",
    quantity: 20,
    unitPrice: 150,
    totalAmount: 3000,
    deliveryDate: "2026-04-15",
  };

  it("calls interruptForApproval with correct payload", async () => {
    mockInterrupt.mockReturnValueOnce({ approved: false });

    await createPurchaseOrder("user-1", "procurement", sampleInput);

    expect(mockInterrupt).toHaveBeenCalledOnce();
    const callArgs = mockInterrupt.mock.calls[0][0];
    expect(callArgs.action).toBe("create_purchase_order");
    expect(callArgs.agentType).toBe("procurement");
    expect(callArgs.description).toContain("Office Chairs");
    expect(callArgs.description).toContain("Acme Supply Co");
    expect(callArgs.description).toContain("3000");
  });

  it("returns cancelled message when user rejects", async () => {
    mockInterrupt.mockReturnValueOnce({ approved: false });

    const result = await createPurchaseOrder("user-1", "procurement", sampleInput);

    expect(result.created).toBe(false);
    expect(result.message).toBe("Purchase order creation cancelled by user.");
    expect(result.poId).toBeUndefined();
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("creates PO in agent_assets when approved", async () => {
    mockInterrupt.mockReturnValueOnce({ approved: true });
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: "po-uuid-001" }] });

    const result = await createPurchaseOrder("user-1", "procurement", sampleInput);

    expect(result.created).toBe(true);
    expect(result.poId).toBe("po-uuid-001");
    expect(result.message).toContain("Purchase order #po-uuid-001");
    expect(result.message).toContain("3000");
    expect(result.message).toContain("Acme Supply Co");

    // Verify correct DB insert
    expect(mockPool.query).toHaveBeenCalledOnce();
    const query = mockPool.query.mock.calls[0][0];
    expect(query).toContain("agent_assets");
    expect(query).toContain("purchase_order");
    expect(query).toContain("RETURNING id");
  });
});
