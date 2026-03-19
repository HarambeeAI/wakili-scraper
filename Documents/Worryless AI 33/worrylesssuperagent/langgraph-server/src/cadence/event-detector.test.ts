/**
 * event-detector.test.ts — Tests for event type definitions and prompts
 *
 * Verifies:
 * - EVENT_TYPES contains all expected event types
 * - EVENT_PROMPTS maps each event to the correct agent type
 * - Event prompts trigger correct tool classification regex
 * - No event prompt contains HITL-triggering keywords
 * - getEventPrompt handles known and unknown event types
 */

import { describe, it, expect } from "vitest";
import {
  EVENT_TYPES,
  EVENT_PROMPTS,
  getEventPrompt,
} from "./event-detector.js";
import { classifyAccountantRequest } from "../agents/accountant.js";
import { classifySalesRequest } from "../agents/sales-rep.js";
import { classifyLegalRequest } from "../agents/legal-compliance.js";

const HITL_REGEX =
  /\b(chase|send\s+reminder|send\s+email|send\s+outreach|publish\s+post|create\s+event|approve|purchase\s+order)\b/i;

function assertNoHITL(eventType: string, prompt: string) {
  const match = HITL_REGEX.exec(prompt);
  if (match) {
    throw new Error(
      `HITL keyword "${match[0]}" found in ${eventType} event prompt`,
    );
  }
}

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

describe("EVENT_PROMPTS agent mapping", () => {
  it("overdue_invoice maps to accountant", () => {
    expect(EVENT_PROMPTS.overdue_invoice.agentType).toBe("accountant");
  });

  it("stale_deal maps to sales_rep", () => {
    expect(EVENT_PROMPTS.stale_deal.agentType).toBe("sales_rep");
  });

  it("expiring_contract maps to legal_advisor", () => {
    expect(EVENT_PROMPTS.expiring_contract.agentType).toBe("legal_advisor");
  });
});

describe("event prompt classification", () => {
  it("overdue_invoice prompt triggers isInvoiceQuery", () => {
    const cls = classifyAccountantRequest(EVENT_PROMPTS.overdue_invoice.prompt);
    expect(cls.isInvoiceQuery).toBe(true);
  });

  it("overdue_invoice prompt triggers isCashflowQuery", () => {
    const cls = classifyAccountantRequest(EVENT_PROMPTS.overdue_invoice.prompt);
    expect(cls.isCashflowQuery).toBe(true);
  });

  it("overdue_invoice prompt does NOT trigger isChaseInvoice", () => {
    const cls = classifyAccountantRequest(EVENT_PROMPTS.overdue_invoice.prompt);
    expect(cls.isChaseInvoice).toBe(false);
  });

  it("stale_deal prompt triggers isStaleDeals", () => {
    const cls = classifySalesRequest(EVENT_PROMPTS.stale_deal.prompt);
    expect(cls.isStaleDeals).toBe(true);
  });

  it("stale_deal prompt triggers isEmailEngagement", () => {
    const cls = classifySalesRequest(EVENT_PROMPTS.stale_deal.prompt);
    expect(cls.isEmailEngagement).toBe(true);
  });

  it("stale_deal prompt does NOT trigger isSendOutreach", () => {
    const cls = classifySalesRequest(EVENT_PROMPTS.stale_deal.prompt);
    expect(cls.isSendOutreach).toBe(false);
  });

  it("expiring_contract prompt triggers isContractCalendar", () => {
    const cls = classifyLegalRequest(EVENT_PROMPTS.expiring_contract.prompt);
    expect(cls.isContractCalendar).toBe(true);
  });
});

describe("event prompts HITL safety", () => {
  for (const [eventType, config] of Object.entries(EVENT_PROMPTS)) {
    it(`${eventType} prompt has no HITL keywords`, () => {
      expect(() => assertNoHITL(eventType, config.prompt)).not.toThrow();
    });
  }
});

describe("getEventPrompt", () => {
  it("returns correct config for overdue_invoice", () => {
    const result = getEventPrompt("overdue_invoice");
    expect(result).not.toBeNull();
    expect(result!.agentType).toBe("accountant");
    expect(result!.prompt.length).toBeGreaterThan(0);
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
    const result = getEventPrompt("unknown_event");
    expect(result).toBeNull();
  });
});
