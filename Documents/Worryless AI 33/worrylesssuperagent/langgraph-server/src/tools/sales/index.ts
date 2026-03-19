// Sales Rep tools — barrel export
export { generateLeads } from "./generate-leads.js";
export { enrichLeadData } from "./enrich-lead.js";
export { researchProspect } from "./research-prospect.js";
export { composeOutreach } from "./compose-outreach.js";
export { sendOutreach } from "./send-outreach.js";
export { trackEmailEngagement } from "./email-engagement.js";
export { updateDealStatus, scheduleFollowUp, detectStaleDeals } from "./deal-tools.js";
export { createProposal } from "./proposal-tools.js";
export { analyzePipeline, forecastRevenue } from "./pipeline-tools.js";
export type * from "./types.js";
