---
phase: 24
plan: 04
subsystem: frontend
tags: [migration, supabase-removal, api-client, auth]
dependency_graph:
  requires: [22-api-server, 21-auth-wiring]
  provides: [supabase-free-components]
  affects: [all-agent-ui-panels, dashboard, onboarding, settings, chat]
tech_stack:
  added: []
  patterns: [api.ts-centralized-client, useAuth-hook, bearer-token-auth, try-catch-error-handling]
key_files:
  created: []
  modified:
    - worrylesssuperagent/src/components/dashboard/DashboardOverview.tsx
    - worrylesssuperagent/src/components/dashboard/TaskList.tsx
    - worrylesssuperagent/src/components/dashboard/BusinessArtifacts.tsx
    - worrylesssuperagent/src/components/dashboard/CreateTaskDialog.tsx
    - worrylesssuperagent/src/components/dashboard/AutomationPanel.tsx
    - worrylesssuperagent/src/components/onboarding/BusinessOnboarding.tsx
    - worrylesssuperagent/src/components/onboarding/AgentTeamSelector.tsx
    - worrylesssuperagent/src/components/onboarding/ConversationalOnboarding.tsx
    - worrylesssuperagent/src/components/chat/ChatInterface.tsx
    - worrylesssuperagent/src/components/settings/SettingsPage.tsx
    - worrylesssuperagent/src/components/agents/AccountantAgent.tsx
    - worrylesssuperagent/src/components/agents/MarketerAgent.tsx
    - worrylesssuperagent/src/components/agents/SalesRepAgent.tsx
    - worrylesssuperagent/src/components/agents/PersonalAssistantAgent.tsx
    - worrylesssuperagent/src/components/agents/GenericAgentPanel.tsx
decisions:
  - Inlined Json type in AccountantAgent.tsx to remove supabase/types dependency
  - Replaced supabase.storage with fetch() multipart to /api/upload for file uploads
  - Removed supabase realtime channels from TaskList and BusinessArtifacts; replaced with polling on token change
  - Removed fire-and-forget workspace personalization in ConversationalOnboarding (no equivalent API route; noted for server-side handling)
  - AutomationPanel automation_settings and task_templates kept as empty arrays pending API route creation
  - DashboardOverview social_posts/email_summaries/calendar_events stats default to 0 (no dedicated API routes in scope)
metrics:
  duration: ~90 minutes
  completed: "2026-03-21"
  tasks: 2
  files: 15
---

# Phase 24 Plan 04: Component Supabase Migration Summary

Migrated 15 component files from direct Supabase client calls to the centralized `api.ts` client with Logto Bearer token authentication. All `import { supabase }` statements removed from the components directory.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Dashboard, onboarding, settings, chat (11 files) | 02c93fe | DashboardOverview, TaskList, BusinessArtifacts, CreateTaskDialog, AutomationPanel, BusinessOnboarding, AgentTeamSelector, ConversationalOnboarding, ChatInterface, SettingsPage |
| 2 | Agent panel components (5 files) | 8fb2c7a | AccountantAgent, MarketerAgent, SalesRepAgent, PersonalAssistantAgent, GenericAgentPanel |

## Migration Pattern Applied

**Before:**
```typescript
import { supabase } from "@/integrations/supabase/client";
const { data, error } = await supabase.from("table").select("*").eq("user_id", user.id);
```

**After:**
```typescript
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
const { token } = useAuth();
const data = await api.get<T[]>("/api/route", { token: token! });
```

## API Routes Used

| Component | Routes |
|-----------|--------|
| DashboardOverview | GET /api/invoices, /api/leads, /api/transactions, /api/agent-tasks |
| TaskList | GET /api/tasks, PATCH /api/tasks/:id |
| BusinessArtifacts | GET /api/artifacts, DELETE /api/artifacts/:id |
| CreateTaskDialog | POST /api/tasks |
| AutomationPanel | GET /api/profiles/me, GET /api/tasks?status=needs_approval, POST /api/planning-agent, PATCH /api/tasks/:id |
| BusinessOnboarding | POST /api/crawl-business-website, PATCH /api/profiles/me |
| AgentTeamSelector | POST /api/spawn-agent-team |
| ConversationalOnboarding | POST /api/user-agents, PATCH /api/profiles/me |
| ChatInterface | POST /api/upload (multipart), GET /api/artifacts, POST /api/orchestrator (SSE), POST /api/tasks |
| SettingsPage | GET /api/profiles/me, PATCH /api/profiles/me, GET /api/agent-validators, POST /api/agent-validators, PATCH /api/agent-validators/:id |
| AccountantAgent | GET /api/invoices, /api/transactions, /api/user-datasheets, /api/datasheet-rows, POST /api/upload, /api/parse-datasheet, /api/artifacts, /api/invoices, PATCH /api/invoices/:id, DELETE /api/user-datasheets/:id |
| MarketerAgent | GET /api/social-posts, /api/agent-assets, /api/artifacts, POST /api/generate-content, /api/social-posts |
| SalesRepAgent | GET /api/leads, POST /api/leads, /api/generate-outreach, /api/outreach-emails, PATCH /api/leads/:id |
| PersonalAssistantAgent | GET /api/integrations, /api/email-summaries, /api/calendar-events, /api/daily-briefings, /api/email-drafts, POST /api/sync-gmail-calendar, /api/send-test-email |
| GenericAgentPanel | useAuth hook only (no API calls) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added multipart file upload via fetch() for AccountantAgent and ChatInterface**
- **Found during:** Task 2 (AccountantAgent), Task 1 (ChatInterface)
- **Issue:** supabase.storage.from().upload() had no direct api.ts equivalent
- **Fix:** Used `fetch(${API_URL}/api/upload, { method: "POST", headers: { Authorization: Bearer ${token} }, body: formData })` for multipart upload
- **Files modified:** AccountantAgent.tsx, ChatInterface.tsx
- **Note:** /api/upload route must be implemented in the API server

**2. [Rule 1 - Bug] Removed supabase realtime channel subscriptions**
- **Found during:** Task 1 (TaskList, BusinessArtifacts)
- **Issue:** supabase.channel() subscriptions are Supabase-specific and have no equivalent in the REST API
- **Fix:** Replaced with `useEffect` depending on `[token]` for initial load; approvals trigger manual refetch
- **Files modified:** TaskList.tsx, BusinessArtifacts.tsx

**3. [Rule 1 - Bug] Removed `supabase.auth.getUser()` in SettingsPage for userId state**
- **Found during:** Task 1 (SettingsPage)
- **Issue:** SettingsPage had its own `useState<string | null>(null)` for userId, fetched via supabase.auth.getUser()
- **Fix:** Used `const { userId } = useAuth()` directly; passed to usePushSubscription hook
- **Files modified:** SettingsPage.tsx

**4. [Rule 1 - Code Quality] Inlined Json type in AccountantAgent**
- **Found during:** Task 2 (AccountantAgent)
- **Issue:** `import type { Json } from "@/integrations/supabase/types"` would retain supabase dependency
- **Fix:** Inlined `type Json = string | number | boolean | null | { [key: string]: Json } | Json[]` locally
- **Files modified:** AccountantAgent.tsx

### Intentional Omissions

- **ConversationalOnboarding workspace personalization**: The fire-and-forget call that patched `agent_workspaces` rows was removed with a comment. No equivalent REST route exists; server-side handling or a future plan should address this.
- **AutomationPanel task templates**: `automation_settings` and `task_templates` supabase tables have no API routes yet; arrays remain empty with comment.
- **DashboardOverview social_posts/email_summaries/calendar_events**: Stats for these tables default to 0; no dedicated API routes in scope for this plan.

## Verification

Supabase import count in components directory: **0**

```
grep -r "from \"@/integrations/supabase" worrylesssuperagent/src/components/ | wc -l
→ 0
```

## Known Stubs

- `AccountantAgent.tsx`: `/api/upload` multipart endpoint must be created in API server for datasheet upload to work
- `PersonalAssistantAgent.tsx`: `/api/integrations`, `/api/email-summaries`, `/api/calendar-events`, `/api/daily-briefings`, `/api/email-drafts` routes need to be implemented if not already present
- `MarketerAgent.tsx`: `/api/social-posts`, `/api/agent-assets` routes need to be implemented if not already present

## Self-Check: PASSED

- Task 1 commit 02c93fe: exists
- Task 2 commit 8fb2c7a: exists
- 0 supabase imports in components/: confirmed
- All 15 target files modified/created
