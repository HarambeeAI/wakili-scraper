import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB pool — shared across all tests in this file
const mockQuery = vi.fn();

vi.mock("../shared/db.js", () => ({
  getPool: vi.fn().mockReturnValue({
    query: mockQuery,
  }),
}));

describe("data-analyst tools", () => {
  beforeEach(() => {
    // Only clear call history, not implementations — preserves getPool mock
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  describe("crossFunctionalQuery", () => {
    it("returns results for a valid query type", async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { month: "2026-01-01", total: "5000" },
          { month: "2026-02-01", total: "7000" },
        ],
      });

      const { crossFunctionalQuery } = await import("./query-tools.js");
      const result = await crossFunctionalQuery("user-1", "revenue_by_month");

      expect(result.queryType).toBe("revenue_by_month");
      expect(result.rowCount).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("2 row(s)");
    });

    it("returns error message for unknown query type", async () => {
      const { crossFunctionalQuery } = await import("./query-tools.js");
      const result = await crossFunctionalQuery("user-1", "nonexistent_query");

      expect(result.error).toBeDefined();
      expect(result.error).toContain("Unknown query type");
      expect(result.error).toContain("nonexistent_query");
      expect(result.error).toContain("revenue_by_month");
      expect(result.rowCount).toBe(0);
    });

    it("returns empty message when query returns no rows", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { crossFunctionalQuery } = await import("./query-tools.js");
      const result = await crossFunctionalQuery("user-1", "project_status");

      expect(result.rowCount).toBe(0);
      expect(result.message).toContain("no results");
    });

    it("never uses LLM-generated SQL (QUERY_TEMPLATES only)", async () => {
      const { QUERY_TEMPLATES } = await import("./query-tools.js");

      // Verify all templates are pre-defined strings (not functions or dynamic)
      for (const [key, sql] of Object.entries(QUERY_TEMPLATES)) {
        expect(typeof sql).toBe("string");
        expect(sql).toContain("$1"); // parameterized
        expect(sql.toLowerCase()).not.toContain("drop");
        expect(sql.toLowerCase()).not.toContain("delete");
        expect(sql.toLowerCase()).toContain("select");
        expect(key).toBeTruthy();
      }
    });
  });

  describe("kpiAggregation", () => {
    it("aggregates multiple data sources into KPI metrics", async () => {
      // Mock responses for all 5 queries in order (Promise.all order)
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { month: "2026-01", total: "10000" },
            { month: "2026-02", total: "12000" },
          ],
        }) // revenue
        .mockResolvedValueOnce({
          rows: [
            { status: "open", count: "5" },
            { status: "closed_won", count: "3" },
          ],
        }) // leads
        .mockResolvedValueOnce({
          rows: [{ status: "paid", count: "8", total: "24000" }],
        }) // invoices
        .mockResolvedValueOnce({ rows: [{ status: "open", count: "12" }] }) // tickets
        .mockResolvedValueOnce({ rows: [{ status: "active", count: "4" }] }); // projects

      const { kpiAggregation } = await import("./query-tools.js");
      const result = await kpiAggregation("user-1");

      expect(result.metrics).toHaveLength(5);
      expect(result.dataSources).toContain("transactions");
      expect(result.dataSources).toContain("leads");
      expect(result.dataSources).toContain("projects");
      expect(result.message).toContain("5 metric(s)");
      expect(result.message).toContain("5 data source(s)");

      const revMetric = result.metrics.find((m) => m.name === "Total Revenue");
      expect(revMetric).toBeDefined();
      expect(revMetric!.value).toBe(22000);
    });

    it("handles empty data sources gracefully", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { kpiAggregation } = await import("./query-tools.js");
      const result = await kpiAggregation("user-1");

      expect(result.metrics).toHaveLength(5);
      for (const metric of result.metrics) {
        expect(metric.value).toBe(0);
      }
    });
  });

  describe("anomalyDetection", () => {
    it("flags outliers with z-score > 2", async () => {
      // Data with a clear outlier: 10 normal values ~100, one extreme value 10000
      // With 10 normal data points, the outlier z-score is ~3.16 (well above 2.0)
      mockQuery.mockResolvedValue({
        rows: [
          { category: "A", total: "100" },
          { category: "B", total: "95" },
          { category: "C", total: "105" },
          { category: "D", total: "98" },
          { category: "E", total: "102" },
          { category: "F", total: "97" },
          { category: "G", total: "103" },
          { category: "H", total: "99" },
          { category: "I", total: "101" },
          { category: "J", total: "96" },
          { category: "OUTLIER", total: "10000" }, // extreme outlier — z-score ~3.16
        ],
      });

      const { anomalyDetection } = await import("./analysis-tools.js");
      const result = await anomalyDetection("user-1", "expenses_by_category");

      expect(result.anomalies.length).toBeGreaterThan(0);
      const outlier = result.anomalies[0];
      expect(outlier.zScore).toBeGreaterThan(2);
      expect(outlier.value).toBe(10000);
      expect(outlier.dataset).toBe("expenses_by_category");
      expect(result.message).toContain("anomaly");
    });

    it("returns no anomalies when all values are similar", async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { category: "food", total: "100" },
          { category: "travel", total: "105" },
          { category: "office", total: "98" },
        ],
      });

      const { anomalyDetection } = await import("./analysis-tools.js");
      const result = await anomalyDetection("user-1", "expenses_by_category");

      expect(result.anomalies).toHaveLength(0);
      expect(result.message).toContain("No anomalies");
    });

    it("returns error for unknown query type", async () => {
      const { anomalyDetection } = await import("./analysis-tools.js");
      const result = await anomalyDetection("user-1", "bad_query");

      expect(result.error).toBeDefined();
      expect(result.error).toContain("Unknown query type");
    });
  });
});
