/**
 * heartbeat-prompts.test.ts
 *
 * Verifies that each agent's heartbeat prompts contain the correct keywords
 * to trigger the agent's classify*Request tool dispatch regexes, and that
 * NO prompt contains HITL-triggering keywords.
 *
 * Tests use the actual classify*Request functions from each agent file so that
 * any future regex changes automatically break these tests as a safety net.
 */

import { describe, it, expect } from "vitest";
import { HEARTBEAT_PROMPTS, getHeartbeatPrompt } from "./heartbeat-prompts.js";
import { classifyAccountantRequest } from "../agents/accountant.js";
import { classifyMarketerRequest } from "../agents/marketer.js";
import { classifySalesRequest } from "../agents/sales-rep.js";
import { classifyPARequest } from "../agents/personal-assistant.js";

// ── HITL safety guard ─────────────────────────────────────────────────────────

/** Keywords that must NEVER appear in a heartbeat prompt (they trigger HITL paths). */
const HITL_REGEX = /\b(chase|send\s+reminder|send\s+email|publish\s+post|create\s+event|approve|purchase\s+order)\b/i;

function assertNoHITL(agentType: string, tier: string, prompt: string) {
  const match = HITL_REGEX.exec(prompt);
  if (match) {
    throw new Error(
      `HITL keyword "${match[0]}" found in ${agentType}:${tier} prompt: "${prompt.substring(0, 80)}..."`,
    );
  }
}

// ── Accountant prompts ────────────────────────────────────────────────────────

describe("accountant heartbeat prompts", () => {
  const dailyPrompt = HEARTBEAT_PROMPTS.accountant.daily;
  const weeklyPrompt = HEARTBEAT_PROMPTS.accountant.weekly;
  const monthlyPrompt = HEARTBEAT_PROMPTS.accountant.monthly;
  const quarterlyPrompt = HEARTBEAT_PROMPTS.accountant.quarterly;

  it("daily prompt triggers isCashflowQuery", () => {
    const cls = classifyAccountantRequest(dailyPrompt);
    expect(cls.isCashflowQuery).toBe(true);
  });

  it("daily prompt triggers isInvoiceQuery", () => {
    const cls = classifyAccountantRequest(dailyPrompt);
    expect(cls.isInvoiceQuery).toBe(true);
  });

  it("daily prompt triggers isAnomalyQuery", () => {
    const cls = classifyAccountantRequest(dailyPrompt);
    expect(cls.isAnomalyQuery).toBe(true);
  });

  it("daily prompt does NOT trigger isChaseInvoice (no HITL)", () => {
    const cls = classifyAccountantRequest(dailyPrompt);
    expect(cls.isChaseInvoice).toBe(false);
  });

  it("daily prompt has no HITL keywords", () => {
    expect(() => assertNoHITL("accountant", "daily", dailyPrompt)).not.toThrow();
  });

  it("weekly prompt triggers isCashflowQuery", () => {
    const cls = classifyAccountantRequest(weeklyPrompt);
    expect(cls.isCashflowQuery).toBe(true);
  });

  it("weekly prompt triggers isBudgetQuery", () => {
    const cls = classifyAccountantRequest(weeklyPrompt);
    expect(cls.isBudgetQuery).toBe(true);
  });

  it("weekly prompt triggers isInvoiceQuery", () => {
    const cls = classifyAccountantRequest(weeklyPrompt);
    expect(cls.isInvoiceQuery).toBe(true);
  });

  it("weekly prompt triggers isRunwayQuery", () => {
    const cls = classifyAccountantRequest(weeklyPrompt);
    expect(cls.isRunwayQuery).toBe(true);
  });

  it("weekly prompt has no HITL keywords", () => {
    expect(() => assertNoHITL("accountant", "weekly", weeklyPrompt)).not.toThrow();
  });

  it("monthly prompt triggers isPLQuery", () => {
    const cls = classifyAccountantRequest(monthlyPrompt);
    expect(cls.isPLQuery).toBe(true);
  });

  it("monthly prompt triggers isTaxQuery", () => {
    const cls = classifyAccountantRequest(monthlyPrompt);
    expect(cls.isTaxQuery).toBe(true);
  });

  it("monthly prompt triggers isAnomalyQuery", () => {
    const cls = classifyAccountantRequest(monthlyPrompt);
    expect(cls.isAnomalyQuery).toBe(true);
  });

  it("monthly prompt triggers isCashflowQuery", () => {
    const cls = classifyAccountantRequest(monthlyPrompt);
    expect(cls.isCashflowQuery).toBe(true);
  });

  it("monthly prompt has no HITL keywords", () => {
    expect(() => assertNoHITL("accountant", "monthly", monthlyPrompt)).not.toThrow();
  });

  it("quarterly prompt triggers isPLQuery", () => {
    const cls = classifyAccountantRequest(quarterlyPrompt);
    expect(cls.isPLQuery).toBe(true);
  });

  it("quarterly prompt triggers isTaxQuery", () => {
    const cls = classifyAccountantRequest(quarterlyPrompt);
    expect(cls.isTaxQuery).toBe(true);
  });

  it("quarterly prompt triggers isRunwayQuery", () => {
    const cls = classifyAccountantRequest(quarterlyPrompt);
    expect(cls.isRunwayQuery).toBe(true);
  });

  it("quarterly prompt triggers isBudgetQuery (variance)", () => {
    const cls = classifyAccountantRequest(quarterlyPrompt);
    expect(cls.isBudgetQuery).toBe(true);
  });

  it("quarterly prompt has no HITL keywords", () => {
    expect(() => assertNoHITL("accountant", "quarterly", quarterlyPrompt)).not.toThrow();
  });
});

// ── Marketer prompts ──────────────────────────────────────────────────────────

describe("marketer heartbeat prompts", () => {
  const dailyPrompt = HEARTBEAT_PROMPTS.marketer.daily;
  const weeklyPrompt = HEARTBEAT_PROMPTS.marketer.weekly;
  const monthlyPrompt = HEARTBEAT_PROMPTS.marketer.monthly;

  it("daily prompt triggers isFetchAnalytics", () => {
    const cls = classifyMarketerRequest(dailyPrompt);
    expect(cls.isFetchAnalytics).toBe(true);
  });

  it("daily prompt does NOT trigger isPublishPost (no HITL)", () => {
    const cls = classifyMarketerRequest(dailyPrompt);
    expect(cls.isPublishPost).toBe(false);
  });

  it("daily prompt has no HITL keywords", () => {
    expect(() => assertNoHITL("marketer", "daily", dailyPrompt)).not.toThrow();
  });

  it("weekly prompt triggers isFetchAnalytics", () => {
    const cls = classifyMarketerRequest(weeklyPrompt);
    expect(cls.isFetchAnalytics).toBe(true);
  });

  it("weekly prompt triggers isContentCalendar", () => {
    const cls = classifyMarketerRequest(weeklyPrompt);
    expect(cls.isContentCalendar).toBe(true);
  });

  it("weekly prompt triggers isBrandMentions", () => {
    const cls = classifyMarketerRequest(weeklyPrompt);
    expect(cls.isBrandMentions).toBe(true);
  });

  it("weekly prompt has no HITL keywords", () => {
    expect(() => assertNoHITL("marketer", "weekly", weeklyPrompt)).not.toThrow();
  });

  it("monthly prompt triggers isFetchAnalytics", () => {
    const cls = classifyMarketerRequest(monthlyPrompt);
    expect(cls.isFetchAnalytics).toBe(true);
  });

  it("monthly prompt triggers isBrandMentions", () => {
    const cls = classifyMarketerRequest(monthlyPrompt);
    expect(cls.isBrandMentions).toBe(true);
  });

  it("monthly prompt triggers isCompetitorAnalysis", () => {
    const cls = classifyMarketerRequest(monthlyPrompt);
    expect(cls.isCompetitorAnalysis).toBe(true);
  });

  it("monthly prompt has no HITL keywords", () => {
    expect(() => assertNoHITL("marketer", "monthly", monthlyPrompt)).not.toThrow();
  });
});

// ── Sales Rep prompts ─────────────────────────────────────────────────────────

describe("sales_rep heartbeat prompts", () => {
  const dailyPrompt = HEARTBEAT_PROMPTS.sales_rep.daily;
  const weeklyPrompt = HEARTBEAT_PROMPTS.sales_rep.weekly;
  const monthlyPrompt = HEARTBEAT_PROMPTS.sales_rep.monthly;

  it("daily prompt triggers isStaleDeals", () => {
    const cls = classifySalesRequest(dailyPrompt);
    expect(cls.isStaleDeals).toBe(true);
  });

  it("daily prompt triggers isEmailEngagement", () => {
    const cls = classifySalesRequest(dailyPrompt);
    expect(cls.isEmailEngagement).toBe(true);
  });

  it("daily prompt does NOT trigger isSendOutreach (no HITL)", () => {
    const cls = classifySalesRequest(dailyPrompt);
    expect(cls.isSendOutreach).toBe(false);
  });

  it("daily prompt has no HITL keywords", () => {
    expect(() => assertNoHITL("sales_rep", "daily", dailyPrompt)).not.toThrow();
  });

  it("weekly prompt triggers isPipelineAnalysis", () => {
    const cls = classifySalesRequest(weeklyPrompt);
    expect(cls.isPipelineAnalysis).toBe(true);
  });

  it("weekly prompt triggers isRevenueForcast", () => {
    const cls = classifySalesRequest(weeklyPrompt);
    expect(cls.isRevenueForcast).toBe(true);
  });

  it("weekly prompt has no HITL keywords", () => {
    expect(() => assertNoHITL("sales_rep", "weekly", weeklyPrompt)).not.toThrow();
  });

  it("monthly prompt triggers isPipelineAnalysis", () => {
    const cls = classifySalesRequest(monthlyPrompt);
    expect(cls.isPipelineAnalysis).toBe(true);
  });

  it("monthly prompt triggers isRevenueForcast", () => {
    const cls = classifySalesRequest(monthlyPrompt);
    expect(cls.isRevenueForcast).toBe(true);
  });

  it("monthly prompt has no HITL keywords", () => {
    expect(() => assertNoHITL("sales_rep", "monthly", monthlyPrompt)).not.toThrow();
  });
});

// ── Personal Assistant prompts ────────────────────────────────────────────────

describe("personal_assistant heartbeat prompts", () => {
  const dailyPrompt = HEARTBEAT_PROMPTS.personal_assistant.daily;

  it("daily prompt triggers isReadEmails", () => {
    const cls = classifyPARequest(dailyPrompt);
    expect(cls.isReadEmails).toBe(true);
  });

  it("daily prompt triggers isListCalendar", () => {
    const cls = classifyPARequest(dailyPrompt);
    expect(cls.isListCalendar).toBe(true);
  });

  it("daily prompt does NOT trigger isSendEmail (no HITL)", () => {
    const cls = classifyPARequest(dailyPrompt);
    expect(cls.isSendEmail).toBe(false);
  });

  it("daily prompt does NOT trigger isCreateEvent (no HITL)", () => {
    const cls = classifyPARequest(dailyPrompt);
    expect(cls.isCreateEvent).toBe(false);
  });

  it("daily prompt has no HITL keywords", () => {
    expect(() => assertNoHITL("personal_assistant", "daily", dailyPrompt)).not.toThrow();
  });
});

// ── Chief of Staff prompts ────────────────────────────────────────────────────

describe("chief_of_staff heartbeat prompts", () => {
  const dailyPrompt = HEARTBEAT_PROMPTS.chief_of_staff.daily;

  it("daily prompt contains 'briefing'", () => {
    expect(dailyPrompt.toLowerCase()).toContain("briefing");
  });

  it("daily prompt contains 'heartbeat'", () => {
    expect(dailyPrompt.toLowerCase()).toContain("heartbeat");
  });

  it("daily prompt has no HITL keywords", () => {
    expect(() => assertNoHITL("chief_of_staff", "daily", dailyPrompt)).not.toThrow();
  });
});

// ── Coverage: all 13 agent types must exist ───────────────────────────────────

describe("HEARTBEAT_PROMPTS coverage", () => {
  const REQUIRED_AGENT_TYPES = [
    "chief_of_staff",
    "accountant",
    "marketer",
    "sales_rep",
    "personal_assistant",
    "customer_support",
    "legal_advisor",
    "hr_manager",
    "pr_specialist",
    "procurement_officer",
    "data_analyst",
    "operations_manager",
    "coo",
  ];

  for (const agentType of REQUIRED_AGENT_TYPES) {
    it(`has entry for ${agentType}`, () => {
      expect(HEARTBEAT_PROMPTS).toHaveProperty(agentType);
    });

    it(`${agentType} has at least daily and weekly tiers`, () => {
      const prompts = HEARTBEAT_PROMPTS[agentType as keyof typeof HEARTBEAT_PROMPTS];
      expect(prompts).toHaveProperty("daily");
      expect(prompts).toHaveProperty("weekly");
      expect(typeof prompts.daily).toBe("string");
      expect(prompts.daily.length).toBeGreaterThan(10);
      expect(typeof prompts.weekly).toBe("string");
      expect(prompts.weekly.length).toBeGreaterThan(10);
    });
  }
});

// ── getHeartbeatPrompt helper ─────────────────────────────────────────────────

describe("getHeartbeatPrompt", () => {
  it("returns the correct daily prompt for accountant", () => {
    const result = getHeartbeatPrompt("accountant", "daily");
    expect(result).toBe(HEARTBEAT_PROMPTS.accountant.daily);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns the correct weekly prompt for marketer", () => {
    const result = getHeartbeatPrompt("marketer", "weekly");
    expect(result).toBe(HEARTBEAT_PROMPTS.marketer.weekly);
  });

  it("falls back to daily for unknown tier", () => {
    const result = getHeartbeatPrompt("accountant", "unknown_tier");
    expect(result).toBe(HEARTBEAT_PROMPTS.accountant.daily);
  });

  it("falls back to daily for unknown agent type", () => {
    const result = getHeartbeatPrompt("unknown_agent", "daily");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns daily for chief_of_staff", () => {
    const result = getHeartbeatPrompt("chief_of_staff", "daily");
    expect(result).toBe(HEARTBEAT_PROMPTS.chief_of_staff.daily);
  });
});
