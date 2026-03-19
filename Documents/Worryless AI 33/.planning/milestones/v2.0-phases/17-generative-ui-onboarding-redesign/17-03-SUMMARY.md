---
phase: 17-generative-ui-onboarding-redesign
plan: "03"
subsystem: frontend/chat
tags: [generative-ui, chat, dashboard, threading, react]
dependency_graph:
  requires: [17-01, 17-02]
  provides: [AgentChatView, ThreadListSidebar, Dashboard routing]
  affects: [Dashboard.tsx, all agent tabs]
tech_stack:
  added: []
  patterns: [useAgentChat hook integration, SSE streaming UI, ReactMarkdown rendering, two-column chat layout]
key_files:
  created:
    - worrylesssuperagent/src/components/chat/AgentChatView.tsx
    - worrylesssuperagent/src/components/chat/ThreadListSidebar.tsx
    - worrylesssuperagent/src/__tests__/AgentChatView.test.ts
  modified:
    - worrylesssuperagent/src/pages/Dashboard.tsx
decisions:
  - AgentChatView uses a plain div with scrollRef for scroll-to-bottom instead of ScrollArea ref (Radix ScrollArea does not expose a scrollable DOM node via ref)
  - Dead code imports (AccountantAgent, MarketerAgent, SalesRepAgent, PersonalAssistantAgent, ChatInterface, GenericAgentPanel) preserved in Dashboard.tsx per plan spec
  - GenericAgentPanel replaced for ALL agent: prefixed views with AgentChatView, removing the intermediate static panel entirely
metrics:
  duration: "~7 minutes"
  tasks_completed: 2
  files_changed: 4
  completed_date: "2026-03-19"
---

# Phase 17 Plan 03: AgentChatView + Dashboard Routing Summary

Two-column generative chat view wired into Dashboard replacing all 5 static agent cases using the useAgentChat SSE hook.

## What Was Built

**AgentChatView** (`worrylesssuperagent/src/components/chat/AgentChatView.tsx`):
- Full-page two-column chat layout replacing static agent dashboards
- Integrates useAgentChat hook for SSE streaming, thread management, HITL approval
- AGENT_META map with 12 agent display names + getAgentIcon switch for lucide icons
- Message bubbles: user (right, primary bg, rounded-br-none) + assistant (left, muted bg, rounded-bl-none)
- ReactMarkdown rendering inside assistant bubbles
- StreamingCursor rendered when `msg.isStreaming` is true
- GenerativeUIRenderer for inline UI components (charts, tables, forms)
- HITLApprovalCard inline in assistant bubbles when `msg.pendingApproval` present
- Loading skeleton (Skeleton component) when streaming starts before first assistant delta
- ToolIndicator above input bar during active tool calls
- Textarea with Enter-to-send (Shift+Enter for newline), auto-focus after send completes
- role="log" + aria-live="polite" on scroll region for screen reader accessibility
- Empty state: Sparkles icon + "Start a conversation" heading + routing description

**ThreadListSidebar** (`worrylesssuperagent/src/components/chat/ThreadListSidebar.tsx`):
- 240px fixed sidebar, hidden on mobile (hidden md:flex pattern)
- "Conversations" header label + Plus icon button for new thread
- Thread items: Bot icon + truncated title + relative timestamp (just now / 5m / 2h / 3d)
- Active thread: bg-primary/10 text-primary highlight
- Hover state: bg-muted/60
- Empty state: "No past conversations" centered text
- formatRelativeTime helper computes readable relative time from ISO date strings

**Dashboard.tsx** (`worrylesssuperagent/src/pages/Dashboard.tsx`):
- Imported AgentChatView from @/components/chat/AgentChatView
- Replaced 5 static cases with AgentChatView:
  - accountant → agentType="accountant"
  - marketer → agentType="marketer"
  - sales → agentType="sales_rep"
  - assistant → agentType="personal_assistant"
  - chat → agentType="chief_of_staff"
- Replaced GenericAgentPanel default case with AgentChatView for all agent: prefixed views
- Static component imports preserved as dead code

**Unit Tests** (`worrylesssuperagent/src/__tests__/AgentChatView.test.ts`) — 6/6 passing:
- Test 1: Empty messages renders "Start a conversation"
- Test 2: User message content rendered in DOM
- Test 3: Assistant message rendered via ReactMarkdown mock
- Test 4: role="log" + aria-live="polite" present
- Test 5: Send button disabled when input empty
- Test 6: Send button disabled when isStreaming=true

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Verified
- [x] `worrylesssuperagent/src/components/chat/AgentChatView.tsx` — exists, contains `export function AgentChatView`, `useAgentChat`, `GenerativeUIRenderer`, `StreamingCursor`, `ToolIndicator`, `role="log"`, `aria-live="polite"`, `ReactMarkdown`, `Start a conversation`
- [x] `worrylesssuperagent/src/components/chat/ThreadListSidebar.tsx` — exists, contains `export function ThreadListSidebar`, `No past conversations`
- [x] `worrylesssuperagent/src/__tests__/AgentChatView.test.ts` — 6/6 tests passing
- [x] `worrylesssuperagent/src/pages/Dashboard.tsx` — contains `import { AgentChatView }`, all 5 agent type values, `import { AccountantAgent }`

### Commits Verified
- 62d272b: feat(17-03): AgentChatView and ThreadListSidebar components with unit test
- 85d6312: feat(17-03): Dashboard.tsx routing -- replace static agent dashboards with AgentChatView

## Self-Check: PASSED
