import { interrupt, Command } from "@langchain/langgraph";
import type { AgentTypeId } from "../types/agent-types.js";
import type { PendingApproval } from "../types/agent-state.js";

// High-risk action categories that require HITL approval
export const HIGH_RISK_ACTIONS = [
  "send_email",
  "publish_post",
  "create_purchase_order",
  "chase_overdue_invoice",
  "create_calendar_event",
  "send_outreach",
] as const;

export type HighRiskAction = typeof HIGH_RISK_ACTIONS[number];

export interface InterruptPayload {
  action: string;
  agentType: AgentTypeId;
  description: string;
  payload: Record<string, unknown>;
}

export interface ApprovalDecision {
  approved: boolean;
  feedback?: string;
}

// Pauses graph execution for human approval before a high-risk action.
//
// Usage pattern (inside a tool-execution node):
//   const approval = interruptForApproval({ action: "send_email", agentType, description, payload });
//   if (!approval.approved) return { messages: [new AIMessage("Action cancelled by user.")] };
//   // proceed with tool execution
//
// When LangGraph encounters interrupt() it pauses the graph and surfaces the
// payload to the client. On resume the client sends Command({ resume: { approved: bool } }).
export function interruptForApproval(interruptPayload: InterruptPayload): ApprovalDecision {
  // interrupt() pauses execution and includes the payload in the graph interrupt value.
  // When resumed with Command({ resume: { approved: true/false } }), it returns the resume value.
  const decision = interrupt<InterruptPayload, ApprovalDecision>(interruptPayload);
  return decision;
}

// Creates an interrupt node for use in StateGraph.addNode().
// The node adds the pending approval to state and interrupts graph execution.
//
// Usage:
//   builder.addNode("interrupt_send_email", createInterruptNode("send_email"))
export function createInterruptNode(action: string) {
  return async (state: { agentType: string; userId: string }) => {
    const approvalId = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const pendingApproval: PendingApproval = {
      id: approvalId,
      action,
      agentType: state.agentType as AgentTypeId,
      description: `Requesting approval for: ${action}`,
      payload: {},
      createdAt: new Date().toISOString(),
    };

    // This will pause graph execution and surface pendingApproval to the client
    const decision = interrupt<PendingApproval, ApprovalDecision>(pendingApproval);

    if (!decision.approved) {
      return {
        pendingApprovals: [] as PendingApproval[],  // Clear pending on rejection
      };
    }

    return {
      pendingApprovals: [] as PendingApproval[],  // Clear pending on approval
    };
  };
}

// Creates the resume Command to send back to a paused graph.
// Used by the /invoke/resume route to continue an interrupted thread.
//
// Usage:
//   const cmd = createResumeCommand(true); // user approved
//   await graph.invoke(cmd, { configurable: { thread_id } });
export function createResumeCommand(approved: boolean, feedback?: string): Command {
  return new Command({
    resume: { approved, feedback } as ApprovalDecision,
  });
}
