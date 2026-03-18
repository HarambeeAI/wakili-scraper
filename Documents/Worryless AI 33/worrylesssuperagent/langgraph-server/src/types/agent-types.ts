// The exact agent_type IDs from available_agent_types seed migration
export const AGENT_TYPES = {
  CHIEF_OF_STAFF: "chief_of_staff",
  ACCOUNTANT: "accountant",
  MARKETER: "marketer",
  SALES_REP: "sales_rep",
  PERSONAL_ASSISTANT: "personal_assistant",
  CUSTOMER_SUPPORT: "customer_support",
  LEGAL_COMPLIANCE: "legal_compliance",
  HR: "hr",
  PR_COMMS: "pr_comms",
  PROCUREMENT: "procurement",
  DATA_ANALYST: "data_analyst",
  OPERATIONS: "operations",
  COO: "coo",
} as const;

export type AgentTypeId = typeof AGENT_TYPES[keyof typeof AGENT_TYPES];

// Chief of Staff routes directly to these 5 specialist subgraphs
export const COS_DIRECT_REPORTS: AgentTypeId[] = [
  AGENT_TYPES.ACCOUNTANT,
  AGENT_TYPES.MARKETER,
  AGENT_TYPES.SALES_REP,
  AGENT_TYPES.PERSONAL_ASSISTANT,
  AGENT_TYPES.COO,
];

// COO routes to these 7 operational agent subgraphs
export const COO_REPORTS: AgentTypeId[] = [
  AGENT_TYPES.CUSTOMER_SUPPORT,
  AGENT_TYPES.LEGAL_COMPLIANCE,
  AGENT_TYPES.HR,
  AGENT_TYPES.PR_COMMS,
  AGENT_TYPES.PROCUREMENT,
  AGENT_TYPES.DATA_ANALYST,
  AGENT_TYPES.OPERATIONS,
];

// All routable agents (everything except chief_of_staff itself)
export const ALL_ROUTABLE_AGENTS: AgentTypeId[] = [
  ...COS_DIRECT_REPORTS,
  ...COO_REPORTS,
];

// Agent display names for response metadata
export const AGENT_DISPLAY_NAMES: Record<AgentTypeId, string> = {
  chief_of_staff: "Chief of Staff",
  accountant: "Accountant",
  marketer: "Marketer",
  sales_rep: "Sales Rep",
  personal_assistant: "Personal Assistant",
  customer_support: "Customer Support",
  legal_compliance: "Legal & Compliance",
  hr: "HR",
  pr_comms: "PR & Comms",
  procurement: "Procurement",
  data_analyst: "Data Analyst",
  operations: "Operations",
  coo: "COO",
};
