/**
 * event-detector.test.ts — Tests for EVENT_TYPES, EVENT_PROMPTS, getEventPrompt
 *
 * Verifies:
 * 1. EVENT_TYPES contains the three expected event type values
 * 2. EVENT_PROMPTS maps each event type to the correct agent_type
 * 3. getEventPrompt returns correct config for known events, null for unknown
 * 4. Prompt keywords trigger the correct tool dispatch regexes
 * 5. No prompt contains HITL-triggering keywords
 */

import { describe, it, expect } from "vitest";
import { EVENT_TYPES, EVENT_PROMPTS, getEventPrompt } from "./event-detector.js";

// ── Regex mirrors from agent classify functions ────────────────────────────────
// These replicate the regex patterns from accountant.ts and sales-rep.ts so we
// can verify that event prompts trigger the correct tool dispatch paths.

const ACCOUNTANT_REGEX = {
  isInvoiceQuery: /\b(invoices?|bills?|receivables?|outstanding|owed)\b/i,
  isCashflowQuery: /\b(cashflow|cash.?flow|projection|forecast.*cash)\b/i,
  // isChaseInvoice — must NOT be triggered
  isChaseInvoice: /\b(chase|remind|follow.*up.*invoice|overdue.*invoice|payment.*reminder)\b/i,
};

const SALES_REGEX = {
  isStaleDeals: /\b(stale|stuck|cold|inactive|aging|dormant).*(deal|lead|pipeline)\b/i,
  isEmailEngagement: /\b(open|click|engage|track|response|reply).*(email|outreach)\b/i,
  // isSendOutreach — must NOT be triggered
  isSendOutreach: /\b(send|deliver|dispatch).*(email|outreach|message)\b/i,
};

// HITL keyword patterns — none of these should appear in event prompts
const HITL_PATTERNS = [
  /\bchase\b/i,
  /\bsend reminder\b/i,
  /\bsend outreach\b/i,
  /\bsend email\b/i,
  /\bpublish\b/i,
  /\bcreate event\b/i,
  /\bschedule event\b/i,
  /\bapprove\b/i,
  /\bpurchase order\b/i,
];

// ── EVENT_TYPES ────────────────────────────────────────────────────────────────

describe("EVENT_TYPES", () => {
  it("contains overdue_invoice", () => {
    expect(EVENT_TYPES.OVERDUE_INVOICE).toBe("overdue_invoice");
  });

  it("contains stale_deal", () => {
    expect(EVENT_TYPES.STALE_DEAL).toBe("stale_deal");
  });

  it("contains expiring_contract", () => {
    expect(EVENT_TYPES.EXPIRING_CONTRACT).toBe("expiring_contract");
  });

  it("has exactly 3 event types", () => {
    expect(Object.keys(EVENT_TYPES)).toHaveLength(3);
  });
});

// ── EVENT_PROMPTS structure ────────────────────────────────────────────────────

describe("EVENT_PROMPTS", () => {
  it("overdue_invoice maps to agent_type accountant", () => {
    expect(EVENT_PROMPTS.overdue_invoice.agentType).toBe("accountant");
  });

  it("stale_deal maps to agent_type sales_rep", () => {
    expect(EVENT_PROMPTS.stale_deal.agentType).toBe("sales_rep");
  });

  it("expiring_contract maps to agent_type legal_advisor", () => {
    expect(EVENT_PROMPTS.expiring_contract.agentType).toBe("legal_advisor");
  });

  it("all event prompts have non-empty prompt strings", () => {
    for (const [, config] of Object.entries(EVENT_PROMPTS)) {
      expect(config.prompt.length).toBeGreaterThan(20);
    }
  });
});

// ── getEventPrompt ─────────────────────────────────────────────────────────────

describe("getEventPrompt", () => {
  it("returns correct config for overdue_invoice", () => {
    const result = getEventPrompt("overdue_invoice");
    expect(result).not.toBeNull();
    expect(result!.agentType).toBe("accountant");
  });

  it("returns correct config for stale_deal", () => {
    const result = getEventPrompt("stale_deal");
    expect(result).not.toBeNull();
    expect(result!.agentType).toBe("sales_rep");
  });

  it("returns correct config for expiring_contract", () => {
    const result = getEventPrompt("expiring_contract");
    expect(result).not.toBeNull();
    expect(result!.agentType).toBe("legal_advisor");
  });

  it("returns null for unknown event type", () => {
    expect(getEventPrompt("unknown_event")).toBeNull();
    expect(getEventPrompt("")).toBeNull();
    expect(getEventPrompt("viral_post")).toBeNull();
  });
});

// ── Prompt keyword verification ────────────────────────────────────────────────

describe("overdue_invoice prompt keywords", () => {
  const prompt = EVENT_PROMPTS.overdue_invoice.prompt;

  it("contains 'invoices' to trigger isInvoiceQuery", () => {
    expect(ACCOUNTANT_REGEX.isInvoiceQuery.test(prompt)).toBe(true);
  });

  it("contains 'cashflow' to trigger isCashflowQuery", () => {
    expect(ACCOUNTANT_REGEX.isCashflowQuery.test(prompt)).toBe(true);
  });

  it("does NOT trigger isChaseInvoice regex", () => {
    // prompt must not contain 'overdue invoice', 'chase', 'remind', etc.
    expect(ACCOUNTANT_REGEX.isChaseInvoice.test(prompt)).toBe(false);
  });
});

describe("stale_deal prompt keywords", () => {
  const prompt = EVENT_PROMPTS.stale_deal.prompt;

  it("contains 'stale deals' to trigger isStaleDeals", () => {
    expect(SALES_REGEX.isStaleDeals.test(prompt)).toBe(true);
  });

  it("contains email engagement keywords to trigger isEmailEngagement", () => {
    expect(SALES_REGEX.isEmailEngagement.test(prompt)).toBe(true);
  });

  it("does NOT trigger isSendOutreach regex", () => {
    expect(SALES_REGEX.isSendOutreach.test(prompt)).toBe(false);
  });
});

describe("expiring_contract prompt keywords", () => {
  const prompt = EVENT_PROMPTS.expiring_contract.prompt;

  it("contains contract-related keywords", () => {
    expect(/\bcontract\b/i.test(prompt)).toBe(true);
  });

  it("contains 'expir' to indicate expiry detection", () => {
    expect(/expir/i.test(prompt)).toBe(true);
  });
});

// ── HITL keyword guard ─────────────────────────────────────────────────────────

describe("No event prompt triggers HITL keywords", () => {
  for (const [eventType, config] of Object.entries(EVENT_PROMPTS)) {
    for (const pattern of HITL_PATTERNS) {
      it(`${eventType} prompt does not match HITL pattern ${pattern}`, () => {
        expect(pattern.test(config.prompt)).toBe(false);
      });
    }
  }
});
