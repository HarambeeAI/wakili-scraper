/**
 * heartbeat-prompts.ts — Multi-tier heartbeat prompt library
 *
 * Exports HEARTBEAT_PROMPTS keyed by agent type and cadence tier.
 * Each prompt is carefully worded to:
 *   1. Trigger the correct tool dispatch regex in each agent's classify*Request function
 *   2. NOT contain HITL-triggering keywords (chase, send email, send reminder,
 *      publish post, create event, approve, purchase order)
 *   3. Use passive/analytical language: check, review, analyze, list, detect, flag, surface
 *
 * CRITICAL KEYWORD NOTES:
 * - accountant isChaseInvoice: /\b(chase|remind|follow.*up.*invoice|overdue.*invoice|payment.*reminder)\b/i
 *   "overdue.*invoice" WILL trigger isChaseInvoice — use "invoices with outstanding balances" instead
 * - marketer isPublishPost: /\b(publish|post|send|submit).*(now|immediately|live|...)\b/i
 *   Avoid "publish" anywhere in marketer prompts
 * - sales isEmailEngagement: /\b(open|click|engage|track|response|reply).*(email|outreach)\b/i
 *   Use "track email engagement" or "check email open/click rates"
 *
 * Agents covered (all 13):
 *   chief_of_staff, accountant, marketer, sales_rep, personal_assistant,
 *   customer_support, legal_advisor, hr_manager, pr_specialist,
 *   procurement_officer, data_analyst, operations_manager, coo
 */

// ── Type definitions ──────────────────────────────────────────────────────────

export type CadenceTier = "daily" | "weekly" | "monthly" | "quarterly";

export interface AgentHeartbeatPrompts {
  daily: string;
  weekly: string;
  monthly?: string;
  quarterly?: string;
}

export type HeartbeatPromptsRecord = Record<string, AgentHeartbeatPrompts>;

// ── DEFAULT_CADENCE_CONFIG ────────────────────────────────────────────────────
// TypeScript mirror of the SQL migration DEFAULT JSONB value.
// Used by CAD-08 tests to verify the constant matches the DB schema.

export const DEFAULT_CADENCE_CONFIG = {
  daily_enabled: true,
  weekly_enabled: true,
  monthly_enabled: false,
  quarterly_enabled: false,
  event_triggers_enabled: true,
  event_cooldown_hours: 4,
} as const;

// ── Heartbeat prompts ─────────────────────────────────────────────────────────

export const HEARTBEAT_PROMPTS: HeartbeatPromptsRecord = {
  // ── Chief of Staff ──────────────────────────────────────────────────────────
  // CoS daily: triggers isBriefing regex (/\b(brief|morning|digest|overview|...)\b/)
  // Must contain "briefing", "heartbeat", "action items", "correlate"

  chief_of_staff: {
    daily:
      "Morning briefing: compile today's heartbeat findings across all agents. Review action items that are open or pending. Correlate any cross-agent signals to surface patterns or urgent priorities. Provide a daily digest of what needs the owner's attention.",
    weekly:
      "Weekly briefing: compile a digest of the week's heartbeat findings. Review all outstanding action items and track their status. Correlate trends across agents to surface strategic insights and flag any bottlenecks that have emerged.",
    monthly:
      "Monthly briefing: compile a comprehensive monthly digest summarizing all agent activity. Correlate long-term patterns, review action items completed vs. outstanding, and surface strategic recommendations for the coming month.",
    quarterly:
      "Quarterly briefing: compile a full business overview. Correlate cross-agent insights and findings from the past quarter. Review all major action items and track their outcomes. Surface strategic recommendations and flag any structural concerns.",
  },

  // ── Accountant ──────────────────────────────────────────────────────────────
  // daily:     isCashflowQuery (cashflow), isInvoiceQuery (invoices|outstanding), isAnomalyQuery (anomal)
  //            must NOT trigger isChaseInvoice (no "overdue invoice", "chase", "remind")
  // weekly:    isCashflowQuery (cashflow), isBudgetQuery (budget|variance), isInvoiceQuery (invoices), isRunwayQuery (runway)
  // monthly:   isPLQuery (P&L), isTaxQuery (tax), isAnomalyQuery (anomal), isCashflowQuery (cashflow)
  // quarterly: isPLQuery (P&L), isTaxQuery (tax liability), isRunwayQuery (runway), isBudgetQuery (variance)

  accountant: {
    daily:
      "Daily financial heartbeat: check current cashflow position and 30-day projection. Review invoices with outstanding balances and flag any that are past due. Detect anomalous transactions from the past 24 hours — flag unusual amounts, unknown vendors, or suspicious patterns.",
    weekly:
      "Weekly financial review: analyze cashflow trends and update the 30/60/90-day projection. Review budget vs actual spending variance by category. List all invoices with outstanding balances grouped by age. Calculate runway at the current burn rate to flag if cash reserves are tightening.",
    monthly:
      "Monthly financial summary: generate the P&L report for the month with revenue vs. expenses breakdown. Estimate current tax liability based on income and deductible expenses. Flag unusual or suspicious transactions from the month. Update the cashflow projection with monthly actuals and forecast the next 90 days.",
    quarterly:
      "Quarterly financial review: generate the quarterly P&L report. Calculate tax liability for the quarter including deductions. Review budget variance across all expense categories. Forecast runway at the current burn rate and flag if the business has less than 6 months of cash remaining.",
  },

  // ── Marketer ────────────────────────────────────────────────────────────────
  // daily:     isFetchAnalytics (analytics|engagement|stats), must NOT trigger isPublishPost
  // weekly:    isFetchAnalytics (analytics), isContentCalendar (calendar), isBrandMentions (mention|monitor)
  // monthly:   isFetchAnalytics (analytics|performance), isBrandMentions (brand mention), isCompetitorAnalysis (competitor)

  marketer: {
    daily:
      "Daily marketing check: review analytics and engagement metrics from the past 24 hours across all active social media channels. Flag any posts with unusually high or low performance. Check content queue status and flag if fewer than 3 days of content remain scheduled.",
    weekly:
      "Weekly marketing review: analyze post performance and engagement trends for the week. Review the content calendar for the next two weeks and flag any gaps. Monitor brand mentions across social media and the web. Identify which content pillars are driving the most reach.",
    monthly:
      "Monthly marketing analysis: analyze overall performance metrics and engagement trends for the month. Monitor brand mentions and sentiment. Analyze competitor activity and benchmark our performance against key rivals. Surface the top-performing content formats to replicate.",
    quarterly:
      "Quarterly marketing review: analyze performance trends across the quarter. Monitor brand mentions and sentiment shifts. Analyze competitor strategy and market positioning. Identify which content categories are driving the best engagement and reach.",
  },

  // ── Sales Rep ───────────────────────────────────────────────────────────────
  // daily:     isStaleDeals (stale|stuck|cold|inactive), isEmailEngagement (track|engage.*(email|outreach))
  //            must NOT trigger isSendOutreach (no "send email", "send outreach")
  // weekly:    isPipelineAnalysis (pipeline|funnel|stages), isRevenueForcast (forecast|revenue)
  // monthly:   isPipelineAnalysis (pipeline), isRevenueForcast (forecast|revenue)

  sales_rep: {
    daily:
      "Daily sales check: detect stale deals that have been inactive or stuck in the same pipeline stage for more than 3 days and flag re-engagement opportunities. Track email engagement by reviewing open and click rates on all outreach sent this week. Flag any leads that went cold since yesterday.",
    weekly:
      "Weekly sales review: analyze the full pipeline — count deals by stage, calculate velocity, and identify conversion bottlenecks. Generate a revenue forecast for the next 30 and 90 days based on the current pipeline value and historical close rates.",
    monthly:
      "Monthly sales analysis: analyze the complete pipeline and funnel metrics for the month. Forecast revenue for the next quarter based on current pipeline value and win rates. Identify patterns in closed-won vs. closed-lost deals to surface what's working.",
    quarterly:
      "Quarterly sales review: analyze pipeline performance and conversion rates for the quarter. Forecast revenue for the next two quarters. Surface patterns in deal velocity, win/loss ratios, and stage conversion to identify strategic improvements.",
  },

  // ── Personal Assistant ──────────────────────────────────────────────────────
  // daily:     isReadEmails (read|check|show.*(email|inbox)), isListCalendar (calendar|schedule|events)
  //            must NOT trigger isSendEmail (no "send email")
  //            must NOT trigger isCreateEvent (no "create event", "schedule event")
  // weekly:    isReadEmails, isListCalendar

  personal_assistant: {
    daily:
      "Daily inbox and calendar check: read and triage the inbox — categorize emails by urgency and flag any that require attention today. Review the calendar to list today's and tomorrow's events, attendees, and any scheduling conflicts. Flag any emails awaiting a reply for more than 24 hours.",
    weekly:
      "Weekly inbox and calendar review: read and triage all emails from the past week that are still open or unresolved. Review the calendar for the next two weeks — list upcoming events and flag any conflicts or back-to-back meeting clusters that could drain focus time.",
    monthly:
      "Monthly calendar and communication analysis: review the inbox for recurring threads requiring attention. Analyze calendar and meeting patterns — identify which contacts take the most time and whether meeting load is sustainable.",
    quarterly:
      "Quarterly time and communication review: analyze calendar usage patterns for the quarter. Review inbox volume and response time trends. Surface insights on how time is being allocated across categories.",
  },

  // ── Customer Support ────────────────────────────────────────────────────────
  // COO-managed. These agents are routed through the COO subgraph.
  // Prompts use domain-specific language for ops agents.

  customer_support: {
    daily:
      "Daily customer support check: review all open support tickets and flag any that are unresolved beyond their SLA threshold. Check customer health scores and flag any customers at risk of churn. Surface any recurring issues or complaint patterns from the past 24 hours.",
    weekly:
      "Weekly customer support review: analyze ticket volume, resolution times, and customer satisfaction trends for the week. Review the knowledge base for gaps based on recurring questions. Flag customers with deteriorating health scores for proactive outreach consideration.",
    monthly:
      "Monthly customer support analysis: analyze ticket trends, resolution metrics, and CSAT scores for the month. Review churn risk indicators and surface customers requiring attention. Identify knowledge base improvements based on common unresolved queries.",
    quarterly:
      "Quarterly customer support review: analyze support trends and CSAT performance for the quarter. Surface structural issues in the product or service driving ticket volume. Review churn patterns and identify retention opportunities.",
  },

  // ── Legal Advisor ───────────────────────────────────────────────────────────

  legal_advisor: {
    daily:
      "Daily legal check: review any contracts or agreements pending review or signature. Flag any compliance deadlines approaching within the next 7 days. Check for new regulatory updates relevant to the business's jurisdiction and industry.",
    weekly:
      "Weekly legal review: analyze all active contracts for upcoming renewal or expiry dates. Review compliance obligations and flag any overdue filings or certifications. Surface any new legal risks from recent business activity.",
    monthly:
      "Monthly legal compliance review: audit all active contracts and agreements for risks or expiring terms. Verify regulatory compliance status across all jurisdictions. Flag any outstanding legal actions or liabilities requiring attention.",
    quarterly:
      "Quarterly legal review: conduct a full contract audit for the quarter. Review all regulatory compliance obligations and verify status. Surface any emerging legal risks from business growth or operational changes.",
  },

  // ── HR Manager ──────────────────────────────────────────────────────────────

  hr_manager: {
    daily:
      "Daily HR check: review active job postings and flag any candidates awaiting interview scheduling or feedback. Check onboarding status for new hires and flag any incomplete steps. Surface any pending performance review deadlines.",
    weekly:
      "Weekly HR review: analyze the recruiting pipeline — candidates by stage, time-to-fill metrics, and any positions stalled. Review onboarding progress for all active new hires. Flag any upcoming performance reviews or probation period end dates.",
    monthly:
      "Monthly HR analysis: review hiring pipeline metrics and time-to-fill trends. Analyze onboarding completion rates and flag structural gaps. Review employee engagement signals and flag any retention risks.",
    quarterly:
      "Quarterly HR review: analyze headcount growth vs. plan. Review recruiting efficiency metrics and pipeline health. Surface retention risks and identify teams that are over or under-resourced.",
  },

  // ── PR Specialist ───────────────────────────────────────────────────────────

  pr_specialist: {
    daily:
      "Daily PR check: monitor brand mentions across news, social media, and online channels. Flag any negative sentiment spikes or media coverage requiring a response. Check the status of any active press outreach campaigns.",
    weekly:
      "Weekly PR review: analyze brand mention trends and sentiment for the week. Review media coverage and identify opportunities for earned media. Monitor competitor communications and flag any narratives that could affect our positioning.",
    monthly:
      "Monthly PR analysis: review overall brand mention volume and sentiment trends. Analyze earned media coverage and identify the most effective story angles. Review competitor PR activity and surface strategic opportunities.",
    quarterly:
      "Quarterly PR review: analyze brand sentiment and media coverage trends for the quarter. Review the effectiveness of PR campaigns and earned media outcomes. Surface strategic communications opportunities for the coming quarter.",
  },

  // ── Procurement Officer ─────────────────────────────────────────────────────

  procurement_officer: {
    daily:
      "Daily procurement check: review active supplier orders and flag any deliveries that are delayed or at risk. Check for pending quotes or proposals requiring a decision. Flag any supplier contracts expiring within the next 30 days.",
    weekly:
      "Weekly procurement review: analyze active orders and supplier performance metrics. Review pending quotes and compare supplier pricing. Flag any supply chain risks or recurring delivery issues from the past week.",
    monthly:
      "Monthly procurement analysis: review supplier performance for the month including delivery rates and quality metrics. Analyze spending by category and flag any budget overruns. Identify opportunities to consolidate vendors or renegotiate terms.",
    quarterly:
      "Quarterly procurement review: analyze supplier performance and cost trends for the quarter. Review the vendor portfolio and identify consolidation or renegotiation opportunities. Surface any supply chain risks for the coming quarter.",
  },

  // ── Data Analyst ────────────────────────────────────────────────────────────

  data_analyst: {
    daily:
      "Daily data check: review key business KPIs and flag any metrics that are trending outside expected ranges. Detect any data anomalies or outliers in the past 24 hours of business data. Surface the top 3 insights worth the owner's attention today.",
    weekly:
      "Weekly data analysis: analyze KPI trends for the week across all business functions. Flag any metrics showing significant week-over-week variance. Surface statistical patterns and correlations that could inform business decisions.",
    monthly:
      "Monthly data analysis: generate a comprehensive KPI summary for the month. Identify trends, anomalies, and performance patterns across all data sources. Surface actionable insights and flag metrics that are drifting from targets.",
    quarterly:
      "Quarterly data review: analyze business performance trends for the quarter across all KPIs. Surface statistical insights and flag areas where performance is deviating from plan. Identify data-driven opportunities for the next quarter.",
  },

  // ── Operations Manager ──────────────────────────────────────────────────────

  operations_manager: {
    daily:
      "Daily operations check: review active projects and flag any milestones at risk or past due. Check process health and flag any bottlenecks or blockers reported in the past 24 hours. Surface any SOPs that need updating based on recent process changes.",
    weekly:
      "Weekly operations review: analyze all active projects — milestone status, resource utilization, and any blockers. Identify process bottlenecks and surface optimization opportunities. Flag any projects that are off-track or at risk of missing deadlines.",
    monthly:
      "Monthly operations analysis: review project completion rates and milestone achievements for the month. Analyze process efficiency metrics and flag recurring bottlenecks. Surface SOP improvement opportunities based on operational patterns.",
    quarterly:
      "Quarterly operations review: analyze project delivery performance for the quarter. Review process efficiency and identify systemic bottlenecks or recurring issues. Surface strategic operational improvements to implement in the next quarter.",
  },

  // ── COO ────────────────────────────────────────────────────────────────────
  // COO daily: check all operational agent status, flag bottlenecks

  coo: {
    daily:
      "Daily COO check: review the status of all operational agents — customer support, legal, HR, PR, procurement, data, and operations. Flag any bottlenecks or escalations that need executive attention today. Surface cross-department conflicts or resource constraints.",
    weekly:
      "Weekly COO review: analyze performance across all operational departments for the week. Review key metrics from customer support, HR recruiting pipeline, legal compliance, and operations projects. Flag any department-level issues requiring prioritization or resource reallocation.",
    monthly:
      "Monthly COO analysis: generate a comprehensive operational performance review across all departments. Surface cross-department trends, resource constraints, and efficiency gaps. Flag any structural issues requiring strategic intervention.",
    quarterly:
      "Quarterly COO review: analyze operational performance across all departments for the quarter. Surface strategic operational improvements. Review resource allocation across departments and flag any structural bottlenecks inhibiting growth.",
  },
};

// ── getHeartbeatPrompt helper ─────────────────────────────────────────────────

/**
 * Looks up the heartbeat prompt for a given agent type and cadence tier.
 *
 * Falls back to the daily prompt if:
 * - The agent type is not found in HEARTBEAT_PROMPTS
 * - The requested tier does not exist for the agent type
 *
 * @param agentType   Agent type ID (e.g. "accountant", "marketer")
 * @param cadenceTier Cadence tier (e.g. "daily", "weekly", "monthly", "quarterly")
 * @returns           Prompt string, never empty
 */
export function getHeartbeatPrompt(
  agentType: string,
  cadenceTier: string,
): string {
  const agentPrompts = HEARTBEAT_PROMPTS[agentType];

  if (!agentPrompts) {
    // Fallback for unknown agent type: return a generic daily prompt
    return "Daily operational check: review current status, surface any issues requiring attention, and flag any anomalies or risks identified in the past 24 hours.";
  }

  const tierPrompt = agentPrompts[cadenceTier as CadenceTier];
  if (!tierPrompt) {
    // Fallback: return the daily prompt for the known agent
    return agentPrompts.daily;
  }

  return tierPrompt;
}
