// Re-export all agent graph factories (barrel exports for convenient imports)
export { createAccountantGraph } from "./accountant.js";
export { createMarketerGraph } from "./marketer.js";
export { createSalesRepGraph } from "./sales-rep.js";
export { createPersonalAssistantGraph } from "./personal-assistant.js";
export { createCustomerSupportGraph } from "./customer-support.js";
export { createLegalComplianceGraph } from "./legal-compliance.js";
export { createHRGraph } from "./hr.js";
export { createPRCommsGraph } from "./pr-comms.js";
export { createProcurementGraph } from "./procurement.js";
export { createDataAnalystGraph } from "./data-analyst.js";
export { createOperationsGraph } from "./operations.js";
export { createCOOGraph } from "./coo.js";
export { createBaseAgentGraph } from "./base-agent.js";

import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AGENT_TYPES, type AgentTypeId } from "../types/agent-types.js";
import { createAccountantGraph } from "./accountant.js";
import { createMarketerGraph } from "./marketer.js";
import { createSalesRepGraph } from "./sales-rep.js";
import { createPersonalAssistantGraph } from "./personal-assistant.js";
import { createCustomerSupportGraph } from "./customer-support.js";
import { createLegalComplianceGraph } from "./legal-compliance.js";
import { createHRGraph } from "./hr.js";
import { createPRCommsGraph } from "./pr-comms.js";
import { createProcurementGraph } from "./procurement.js";
import { createDataAnalystGraph } from "./data-analyst.js";
import { createOperationsGraph } from "./operations.js";
import { createCOOGraph } from "./coo.js";

// Registry: look up any agent graph factory by its type ID.
// Enables dynamic agent instantiation: const factory = AGENT_GRAPH_REGISTRY["accountant"]; const graph = factory(checkpointer);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AGENT_GRAPH_REGISTRY: Record<
  AgentTypeId,
  ((checkpointer?: PostgresSaver) => any) | undefined
> = {
  [AGENT_TYPES.CHIEF_OF_STAFF]: undefined, // CoS is the root supervisor, not a subgraph
  [AGENT_TYPES.ACCOUNTANT]: createAccountantGraph,
  [AGENT_TYPES.MARKETER]: createMarketerGraph,
  [AGENT_TYPES.SALES_REP]: createSalesRepGraph,
  [AGENT_TYPES.PERSONAL_ASSISTANT]: createPersonalAssistantGraph,
  [AGENT_TYPES.CUSTOMER_SUPPORT]: createCustomerSupportGraph,
  [AGENT_TYPES.LEGAL_COMPLIANCE]: createLegalComplianceGraph,
  [AGENT_TYPES.HR]: createHRGraph,
  [AGENT_TYPES.PR_COMMS]: createPRCommsGraph,
  [AGENT_TYPES.PROCUREMENT]: createProcurementGraph,
  [AGENT_TYPES.DATA_ANALYST]: createDataAnalystGraph,
  [AGENT_TYPES.OPERATIONS]: createOperationsGraph,
  [AGENT_TYPES.COO]: createCOOGraph,
};
