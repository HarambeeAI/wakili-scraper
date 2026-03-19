/**
 * personal-assistant.ts — Personal Assistant agent with tool-execution node
 *
 * Graph topology: __start__ -> readMemory -> paTools -> llmNode -> writeMemory -> respond
 *
 * The paTools node runs BEFORE the LLM and injects real Google Workspace data
 * into state.businessContext so the LLM always has live data to reason over.
 *
 * Tool dispatch is deterministic (regex heuristics), not LLM function-calling.
 */

import { StateGraph } from "@langchain/langgraph";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AgentState } from "../types/agent-state.js";
import { AGENT_TYPES } from "../types/agent-types.js";
import {
  createLLMNode,
  createRespondNode,
  type BaseAgentConfig,
} from "./base-agent.js";
import { createReadMemoryNode } from "../memory/read-memory.js";
import { createWriteMemoryNode } from "../memory/write-memory.js";
import {
  readEmails,
  triageInbox,
  listCalendarEvents,
  detectCalendarConflicts,
  analyzeTimeAllocation,
} from "../tools/pa/index.js";
import type { PAClassification } from "../tools/pa/index.js";

// ── System Prompt ──────────────────────────────────────────────────────────────

const PERSONAL_ASSISTANT_SYSTEM_PROMPT = `You are the Personal Assistant (Executive Assistant + Google Workspace) for this business owner.

Your role: Manage the CEO's time, communication, and information flow. Not just inbox management — triage, prioritize, draft responses, manage conflicts, prep for meetings, and protect focus time. You are the gatekeeper of the user's attention.

Key capabilities:
- Inbox triage: Categorize emails by urgency (urgent/high/normal/low) and topic (sales, finance, personal, newsletter, spam). Suggest action: respond/delegate/archive
- Email drafting: Match the user's tone, length preference, and sign-off style from learned communication patterns
- Email sending via Gmail API — all sends require user approval before delivery
- Calendar management: list today's/week's events with attendees, location, and agenda
- Calendar event creation with availability check and attendee invites (requires user approval)
- Conflict detection: identify overlapping events and propose resolution options
- Meeting prep: Synthesize attendee background (from email history + contacts), past interactions, agenda items, and relevant Drive documents into a pre-meeting brief
- Google Drive search: find documents by name, content type, or recency
- Task and reminder management: create, update, and track tasks with priority and due dates
- Time allocation analysis: meeting hours vs. focus hours, busiest days, meeting frequency by contact
- Email thread summarization: condense long threads to key points, decisions, and action items
- Response overdue detection: flag emails awaiting reply for more than 24 hours

When answering:
- Always start with what requires attention TODAY (urgent emails, upcoming meetings, overdue tasks)
- Provide specific drafted responses, not just suggestions to respond
- Protect the user's focus time — flag calendar overload and suggest restructuring
- Summarize complex email threads before suggesting a response
- Meeting briefs should be concise (5-7 bullet points) with the most relevant context
- When tool results indicate needsInput, ask the user for the required parameters before proceeding

Google Workspace integration: Gmail (read/send), Google Calendar (read/write), Google Drive (read). Requires one-time Google OAuth setup per user.

You have access to real Google Workspace tools. When you have tool results in your context, use them to provide precise, actionable responses.

Available tools:
- Email: read inbox, triage by urgency/topic, draft responses matching your style, send emails (requires your approval)
- Calendar: list events, create events with availability check (requires your approval), detect conflicts, analyze time allocation
- Meeting prep: synthesize attendee info, email history, and Drive documents into a pre-meeting brief
- Drive: search files by name or content`;

// ── Request Classification ─────────────────────────────────────────────────────

/**
 * Classifies the incoming request using regex heuristics.
 * Deterministic — no LLM call required for classification.
 */
export function classifyPARequest(content: string): PAClassification {
  return {
    isReadEmails:
      /\b(read|check|show|get|fetch).*(email|inbox|mail|messages)\b/i.test(
        content,
      ),
    isTriageInbox:
      /\b(triage|categorize|prioritize|sort|organize).*(inbox|email|mail)\b/i.test(
        content,
      ),
    isDraftEmail:
      /\b(draft|write|compose|reply|respond).*(email|mail|response|message)\b/i.test(
        content,
      ),
    isSendEmail:
      /\b(send|deliver|forward).*(email|mail|message|response)\b/i.test(
        content,
      ),
    isListCalendar:
      /\b(calendar|schedule|events|meetings|agenda|what.*today|what.*week)\b/i.test(
        content,
      ),
    isCreateEvent:
      /\b(create|schedule|book|set up|add).*(event|meeting|appointment|call)\b/i.test(
        content,
      ),
    isMeetingBrief:
      /\b(brief|prep|prepare|summary).*(meeting|call|event)\b/i.test(content),
    isSearchDrive:
      /\b(search|find|look for|locate).*(file|document|doc|drive|folder)\b/i.test(
        content,
      ),
    isDetectConflicts:
      /\b(conflict|overlap|double.?book|clash|schedule.*issue)/i.test(content),
    isTimeAllocation:
      /\b(time.*alloc|meeting.*time|focus.*time|how.*much.*time|time.*spent|busiest)\b/i.test(
        content,
      ),
  };
}

// ── PA Tools Node ──────────────────────────────────────────────────────────────

/**
 * Creates the Personal Assistant data-gathering node.
 *
 * Runs BEFORE the LLM node, dispatching tools based on request classification
 * and injecting results into state.businessContext.paToolResults.
 *
 * Data-gathering tools (read-only) run automatically.
 * Write operations (send email, create event, etc.) require user-provided
 * parameters and are signaled via needsInput.
 */
export function createPAToolsNode() {
  return async (state: typeof AgentState.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const cls = classifyPARequest(content);
    const toolResults: Record<string, unknown> = {};

    // Data-gathering tools (safe to run without additional user params)
    if (cls.isReadEmails) {
      try {
        toolResults.emails = await readEmails(state.userId);
      } catch (err) {
        console.error("[pa-tools] readEmails failed:", err);
      }
    }

    if (cls.isTriageInbox) {
      try {
        toolResults.triageResult = await triageInbox(state.userId);
      } catch (err) {
        console.error("[pa-tools] triageInbox failed:", err);
      }
    }

    if (cls.isListCalendar) {
      try {
        toolResults.calendarEvents = await listCalendarEvents(state.userId);
      } catch (err) {
        console.error("[pa-tools] listCalendarEvents failed:", err);
      }
    }

    if (cls.isDetectConflicts) {
      try {
        toolResults.conflicts = await detectCalendarConflicts(state.userId);
      } catch (err) {
        console.error("[pa-tools] detectCalendarConflicts failed:", err);
      }
    }

    if (cls.isTimeAllocation) {
      try {
        toolResults.timeAllocation = await analyzeTimeAllocation(state.userId);
      } catch (err) {
        console.error("[pa-tools] analyzeTimeAllocation failed:", err);
      }
    }

    // Tools that need user-provided parameters — signal to LLM
    if (cls.isDraftEmail)
      toolResults.needsInput = {
        requestType: "draftEmail",
        message: "Need email ID and optional instructions",
      };
    if (cls.isSendEmail)
      toolResults.needsInput = {
        requestType: "sendEmail",
        message: "Need drafted email details",
      };
    if (cls.isCreateEvent)
      toolResults.needsInput = {
        requestType: "createEvent",
        message: "Need event details (summary, start, end)",
      };
    if (cls.isMeetingBrief)
      toolResults.needsInput = {
        requestType: "meetingBrief",
        message: "Need event ID for meeting brief",
      };
    if (cls.isSearchDrive)
      toolResults.needsInput = {
        requestType: "searchDrive",
        message: "Need search query",
      };

    return {
      businessContext: {
        ...state.businessContext,
        paToolResults: toolResults,
      },
    };
  };
}

// ── Graph Factory ──────────────────────────────────────────────────────────────

/**
 * Creates the compiled Personal Assistant agent graph.
 *
 * Graph topology: __start__ -> readMemory -> paTools -> llmNode -> writeMemory -> respond
 *
 * @param checkpointer  Optional PostgresSaver for state persistence
 */
export function createPersonalAssistantGraph(checkpointer?: PostgresSaver) {
  const config: BaseAgentConfig = {
    agentType: AGENT_TYPES.PERSONAL_ASSISTANT,
    systemPrompt: PERSONAL_ASSISTANT_SYSTEM_PROMPT,
  };

  const graph = new StateGraph(AgentState)
    .addNode("readMemory", createReadMemoryNode())
    .addNode("paTools", createPAToolsNode())
    .addNode("llmNode", createLLMNode(config))
    .addNode("writeMemory", createWriteMemoryNode())
    .addNode("respond", createRespondNode(), { ends: [] })
    .addEdge("__start__", "readMemory")
    .addEdge("readMemory", "paTools")
    .addEdge("paTools", "llmNode")
    .addEdge("llmNode", "writeMemory")
    .addEdge("writeMemory", "respond");

  const compileOpts: Record<string, unknown> = {};
  if (checkpointer) compileOpts.checkpointer = checkpointer;

  return graph.compile(compileOpts);
}
