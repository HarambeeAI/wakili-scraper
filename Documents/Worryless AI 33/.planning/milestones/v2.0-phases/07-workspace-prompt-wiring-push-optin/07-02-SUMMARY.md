---
phase: 07-workspace-prompt-wiring-push-optin
plan: 02
subsystem: edge-functions
tags: [workspace, prompt-injection, orchestrator, chat-with-agent, WS-07]
dependency_graph:
  requires: [07-01]
  provides: [workspace-injected-orchestrator-prompts, workspace-injected-chat-agent-prompts]
  affects: [orchestrator, chat-with-agent]
tech_stack:
  added: []
  patterns: [fetchAndBuildWorkspacePrompt helper, workspace block injection, userId-optional fallback guard]
key_files:
  created: []
  modified:
    - worrylesssuperagent/supabase/functions/orchestrator/index.ts
    - worrylesssuperagent/supabase/functions/chat-with-agent/index.ts
decisions:
  - "fetchAndBuildWorkspacePrompt places workspace block AFTER basePrompt and BEFORE businessKnowledge — preserves WS-07 injection order (IDENTITY→SOUL→SOPs→TOOLS→MEMORY)"
  - "executeSpecialist and executeSpecialistStreaming each create their own supabaseAdmin client internally — consistent with existing fetchBusinessKnowledge pattern"
  - "chat-with-agent uses a self-contained fetchAgentWorkspaceBlock (not imported from orchestrator) — edge functions are independently deployed"
  - "userId-absent path skips all workspace fetches silently in both functions — mirrors existing if (userId) { businessKnowledge = ... } guard"
metrics:
  duration: "3 minutes"
  completed: "2026-03-14T12:06:45Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 7 Plan 02: Workspace Prompt Wiring (Orchestrator + chat-with-agent) Summary

**One-liner:** Workspace file injection (IDENTITY→SOUL→SOPs→TOOLS→MEMORY) wired into orchestrator Chief of Staff and specialist agent prompts, and into chat-with-agent when userId is provided.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add fetchAndBuildWorkspacePrompt helper + wire into orchestrator | 406003e | supabase/functions/orchestrator/index.ts |
| 2 | Wire buildWorkspacePrompt() into chat-with-agent | 0f71319 | supabase/functions/chat-with-agent/index.ts |

## What Was Built

### Task 1: Orchestrator Workspace Wiring

Updated `supabase/functions/orchestrator/index.ts`:

- Added imports for `buildWorkspacePrompt` (from `_shared/buildWorkspacePrompt.ts`) and `sanitizeWorkspaceContent` (from `_shared/sanitize.ts`)
- Added `fetchAndBuildWorkspacePrompt(userId, agentTypeId, supabaseAdmin)` helper that queries `agent_workspaces`, sanitizes content, and returns the formatted workspace block (or `''` on any error)
- Updated `buildAgentPrompt` to accept `userId?: string` and inject the workspace block between `agent.basePrompt` and `businessKnowledge`
- Updated `buildOrchestratorPrompt` to accept optional `workspaceBlock` parameter and inject it as `=== CHIEF OF STAFF WORKSPACE ===` section
- Main handler now creates `supabaseAdmin` client and fetches `chiefWorkspaceBlock` for `chief_of_staff` agent type after `businessKnowledge` fetch
- Updated `executeSpecialist` and `executeSpecialistStreaming` to accept `userId?: string`, create their own admin client internally, and forward both to `buildAgentPrompt`
- Updated all 4 `executeSpecialist` call sites (accountant, marketer, sales_rep, personal_assistant) to pass `userId`
- Updated streaming `createStreamingResponse` helper to pass `userId` to `executeSpecialistStreaming`

### Task 2: chat-with-agent Workspace Wiring

Updated `supabase/functions/chat-with-agent/index.ts`:

- Added imports for `createClient`, `buildWorkspacePrompt`, `sanitizeWorkspaceContent`
- Added self-contained `fetchAgentWorkspaceBlock(userId, agentTypeId)` helper (same pattern as orchestrator's helper, reads env vars internally)
- Updated request body destructuring to accept optional `userId`
- After resolving `config.systemPrompt`, conditionally fetches workspace block and sets `finalSystemPrompt` with appended `=== AGENT WORKSPACE ===` section
- Falls back to unmodified `config.systemPrompt` when `userId` absent — fully non-breaking change

## Verification

All 51 vitest tests pass (8 test files, 1 skipped, 14 todo stubs).

```
Test Files  8 passed | 1 skipped (9)
Tests       51 passed | 14 todo (65)
```

Grep confirms multiple `buildWorkspacePrompt` references in both files (import + helper + call sites).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- orchestrator/index.ts: imports buildWorkspacePrompt, sanitizeWorkspaceContent, has fetchAndBuildWorkspacePrompt helper, buildOrchestratorPrompt accepts workspaceBlock, buildAgentPrompt accepts userId, all executeSpecialist call sites pass userId
- chat-with-agent/index.ts: imports buildWorkspacePrompt, sanitizeWorkspaceContent, has fetchAgentWorkspaceBlock, accepts optional userId in body parsing, injects workspace block when present
- Commits 406003e and 0f71319 exist in worrylesssuperagent repo
- Full vitest suite green
