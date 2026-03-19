/**
 * event-detector.ts — Event type definitions and event-specific prompts
 *
 * Maps detected business events (from check_event_triggers() SQL) to targeted
 * agent prompts. When the proactive-runner receives a message with
 * cadence_tier='event', it uses getEventPrompt() to look up the prompt.
 *
 * Each prompt is worded to trigger the correct tool classification regex
 * WITHOUT triggering HITL paths (no "chase", "send reminder", "send outreach").
 */

// ── Event type constants ────────────────────────────────────────────────────────

export const EVENT_TYPES = {
  OVERDUE_INVOICE: "overdue_invoice",
  STALE_DEAL: "stale_deal",
  EXPIRING_CONTRACT: "expiring_contract",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// ── Event prompt configuration ──────────────────────────────────────────────────

export interface EventPromptConfig {
  agentType: string;
  prompt: string;
}

export const EVENT_PROMPTS: Record<EventType, EventPromptConfig> = {
  overdue_invoice: {
    agentType: "accountant",
    prompt:
      "URGENT EVENT: Invoices with outstanding balances past due date detected. List all invoices that are past due, check cashflow impact of delayed payments, and flag severity by amount and days overdue. Surface findings for review.",
  },
  stale_deal: {
    agentType: "sales_rep",
    prompt:
      "URGENT EVENT: Stale deals detected — leads with no activity in 3+ days. Detect stale deals stuck in the pipeline, track email engagement and open rates on recent outreach for those leads, and provide re-engagement recommendations. Surface findings for review.",
  },
  expiring_contract: {
    agentType: "legal_advisor",
    prompt:
      "URGENT EVENT: Contracts expiring within 7 days detected. Review the contract calendar for upcoming expirations and renewal deadlines. Flag contracts requiring immediate attention and surface findings for review.",
  },
};

// ── Lookup helper ───────────────────────────────────────────────────────────────

/**
 * Get the event prompt configuration for a given event type.
 * Returns null for unknown event types.
 */
export function getEventPrompt(eventType: string): EventPromptConfig | null {
  return EVENT_PROMPTS[eventType as EventType] ?? null;
}
