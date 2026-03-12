# Architecture Patterns

**Domain:** Multi-agent SaaS — agent workspace system + heartbeat dispatcher
**Researched:** 2026-03-12
**Confidence:** HIGH (DB schema, timeout constraints, queue pattern verified against official Supabase docs)

---

## 1. Database Schema

### 1.1 `available_agent_types` — The Static Catalog

This table is the source of truth for all 12 agent types plus the Chief of Staff. It is seeded once via migration and never written to by users. The default MD workspace templates live here so spawning a new agent is a copy-paste from this table, not a prompt call.

```sql
CREATE TABLE available_agent_types (
  id           TEXT PRIMARY KEY,         -- e.g. 'accountant', 'marketer', 'coo'
  display_name TEXT NOT NULL,
  description  TEXT NOT NULL,
  depth        INTEGER NOT NULL DEFAULT 1, -- 0 = orchestrator (chief_of_staff), 1 = specialist
  skills       JSONB NOT NULL DEFAULT '[]', -- ["invoice_parsing", "spreadsheet_analysis", ...]
  default_identity_md   TEXT NOT NULL,
  default_soul_md       TEXT NOT NULL,
  default_sops_md       TEXT NOT NULL,
  default_memory_md     TEXT NOT NULL,
  default_heartbeat_md  TEXT NOT NULL,
  default_tools_md      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);
-- No RLS needed — this is public read-only catalog data
-- No user_id column intentionally
```

Seed rows: 12 specialist types + `chief_of_staff` (depth 0). The 4 existing hardcoded agents (accountant, marketer, sales_rep, personal_assistant) get rows here retroactively so the new system subsumes the old one.

**Confidence: HIGH** — pattern matches existing `task_templates` and `agent_validators` tables in the codebase.

---

### 1.2 `user_agents` — Activated Agents Per User

Tracks which catalog entries a given user has activated. The 4 pre-existing agents are inserted here automatically during onboarding completion (via the updated `planning-agent` edge function). The Chief of Staff always gets a row with `is_always_active = true`.

```sql
CREATE TABLE user_agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type_id TEXT NOT NULL REFERENCES available_agent_types(id),
  activated_at  TIMESTAMPTZ DEFAULT now(),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  heartbeat_interval_hours  INTEGER NOT NULL DEFAULT 4,
  heartbeat_active_hours_start TIME NOT NULL DEFAULT '08:00',
  heartbeat_active_hours_end   TIME NOT NULL DEFAULT '18:00',
  heartbeat_enabled BOOLEAN NOT NULL DEFAULT true,
  last_heartbeat_at TIMESTAMPTZ,
  next_heartbeat_at TIMESTAMPTZ,
  UNIQUE(user_id, agent_type_id)
);

ALTER TABLE user_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own agents" ON user_agents
  FOR ALL USING (auth.uid() = user_id);
```

`next_heartbeat_at` is recalculated after each heartbeat run so the dispatcher can do a simple `WHERE next_heartbeat_at <= now()` query. This avoids scanning all agents.

---

### 1.3 `agent_workspaces` — The 6-File MD System

One row per (user, agent, file). Six rows per activated agent. Never store all 6 files in a single JSONB column — separate rows allow partial updates, individual file auditing, and clean RLS without reading all 6 files on every query.

```sql
CREATE TYPE workspace_file_type AS ENUM (
  'IDENTITY', 'SOUL', 'SOPs', 'MEMORY', 'HEARTBEAT', 'TOOLS'
);

CREATE TABLE agent_workspaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type_id TEXT NOT NULL REFERENCES available_agent_types(id),
  file_type     workspace_file_type NOT NULL,
  content       TEXT NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  updated_by    TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'agent' | 'system'
  UNIQUE(user_id, agent_type_id, file_type)
);

ALTER TABLE agent_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own workspaces" ON agent_workspaces
  FOR ALL USING (auth.uid() = user_id);
```

**Why separate rows, not JSONB columns:** The editor loads one file at a time. An agent updating MEMORY.md doesn't need to read IDENTITY.md. Separate rows mean the DB does the work of isolation. Each file is independently auditable. JSONB for 6 files is premature optimization that adds complexity without benefit at this scale.

**MEMORY.md write control:** The `updated_by` column enforces the business rule. The UI checks `file_type = 'MEMORY'` and renders a read-only view. The heartbeat runner sets `updated_by = 'agent'`. There is no DB-level write restriction on MEMORY rows — enforcement is in application code (UI and edge functions only write MEMORY from agent context).

**Auto-population trigger:** When a row is inserted into `user_agents`, a Postgres trigger calls a function that copies the 6 default template rows from `available_agent_types` into `agent_workspaces` for that user+agent. This keeps workspace creation atomic with agent activation.

```sql
CREATE OR REPLACE FUNCTION create_agent_workspace()
RETURNS TRIGGER AS $$
DECLARE
  agent_rec available_agent_types%ROWTYPE;
BEGIN
  SELECT * INTO agent_rec FROM available_agent_types WHERE id = NEW.agent_type_id;
  INSERT INTO agent_workspaces (user_id, agent_type_id, file_type, content, updated_by)
  VALUES
    (NEW.user_id, NEW.agent_type_id, 'IDENTITY',  agent_rec.default_identity_md,  'system'),
    (NEW.user_id, NEW.agent_type_id, 'SOUL',      agent_rec.default_soul_md,      'system'),
    (NEW.user_id, NEW.agent_type_id, 'SOPs',      agent_rec.default_sops_md,      'system'),
    (NEW.user_id, NEW.agent_type_id, 'MEMORY',    agent_rec.default_memory_md,    'system'),
    (NEW.user_id, NEW.agent_type_id, 'HEARTBEAT', agent_rec.default_heartbeat_md, 'system'),
    (NEW.user_id, NEW.agent_type_id, 'TOOLS',     agent_rec.default_tools_md,     'system')
  ON CONFLICT (user_id, agent_type_id, file_type) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_agent_activated
  AFTER INSERT ON user_agents
  FOR EACH ROW EXECUTE FUNCTION create_agent_workspace();
```

---

### 1.4 `agent_heartbeat_log` — Sparse Logging (Non-OK Runs Only)

Per the project decision: suppress HEARTBEAT_OK writes. Only log runs that surfaced something. This reduces DB writes by ~90% on quiet systems.

```sql
CREATE TYPE heartbeat_outcome AS ENUM ('surfaced', 'error');

CREATE TABLE agent_heartbeat_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type_id TEXT NOT NULL REFERENCES available_agent_types(id),
  run_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome       heartbeat_outcome NOT NULL,
  summary       TEXT,           -- What the agent surfaced (truncated, for notification)
  task_created  BOOLEAN DEFAULT false,
  notification_sent BOOLEAN DEFAULT false,
  error_message TEXT            -- Populated if outcome = 'error'
);

ALTER TABLE agent_heartbeat_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own heartbeat logs" ON agent_heartbeat_log
  FOR SELECT USING (auth.uid() = user_id);
-- INSERT done by edge function using service role — no INSERT policy needed for users

CREATE INDEX idx_heartbeat_log_user_agent ON agent_heartbeat_log (user_id, agent_type_id, run_at DESC);
```

The `user_agents.last_heartbeat_at` column is updated on every run (OK or surfaced) — it's the lightweight "last seen" indicator for the UI. The full log only captures meaningful events.

---

### 1.5 Schema Dependency Order (Build This First)

```
available_agent_types  (no deps — seed data migration)
       |
user_agents            (deps: auth.users, available_agent_types)
       |
agent_workspaces       (deps: auth.users, available_agent_types, trigger on user_agents)
       |
agent_heartbeat_log    (deps: auth.users, available_agent_types)
```

---

## 2. Heartbeat Dispatcher Architecture

### 2.1 Why Not One Cron Per Agent

Supabase `pg_cron` has a practical limit of ~50-100 jobs before performance degrades (the jobs metadata table is queried on every scheduler tick). A platform with 500 users each with 5 active agents would require 2,500 cron rows — this is not viable.

**Confidence: MEDIUM** — Supabase docs recommend "no more than 8 jobs running concurrently" and the 10-minute max per job. The slot limit is inferred from pg_cron internals and community reports, not officially documented.

### 2.2 Recommended Pattern: Dispatcher + Queue

This pattern is verified against official Supabase documentation for queue-based fan-out.

```
pg_cron (every 5 minutes)
    |
    v
heartbeat-dispatcher edge function
    |
    +-- Query: SELECT * FROM user_agents
    |   WHERE heartbeat_enabled = true
    |   AND next_heartbeat_at <= now()
    |   AND is_active = true
    |   LIMIT 50  -- safety cap per batch
    |
    +-- For each due agent row:
    |   INSERT INTO pgmq queue: heartbeat_jobs
    |   { user_id, agent_type_id, user_agent_id }
    |
    +-- UPDATE user_agents SET
            next_heartbeat_at = now() + (heartbeat_interval_hours * interval '1 hour'),
            last_heartbeat_at = now()
        WHERE id = $user_agent_id
```

```
pg_cron (every 30 seconds)
    |
    v
heartbeat-runner edge function
    |
    +-- pgmq.read('heartbeat_jobs', sleep_seconds: 0, n: 5)
    |
    +-- For each message:
    |   1. Fetch agent workspaces (HEARTBEAT.md, SOPs.md, MEMORY.md snippets)
    |   2. Fetch recent agent_tasks for this user/agent (last 7 days)
    |   3. Fetch business context from profiles + business_artifacts
    |   4. Call Lovable AI Gateway with assembled context
    |   5. Parse response:
    |      - "HEARTBEAT_OK" → pgmq.delete(msg_id), no DB write
    |      - Any other content → INSERT agent_heartbeat_log (surfaced),
    |                            optionally INSERT agent_tasks,
    |                            trigger notification
    |   6. pgmq.delete(msg_id)
```

### 2.3 Timeout Safety Analysis

- **Dispatcher function**: Queries DB, inserts queue rows, updates `next_heartbeat_at`. Pure SQL I/O. Completes in < 5 seconds even for 50 agents. Well within 150s idle timeout.
- **Runner function**: Reads 5 messages per invocation. Each message = 1 LLM call (~2-8 seconds for Gemini Flash) + DB reads/writes. 5 agents x 8 seconds max = 40 seconds. Well within 150s timeout.
- **Burst protection**: The `LIMIT 50` in dispatcher and `n: 5` in runner prevent a single invocation from processing too many agents. The cron frequency (every 30 seconds for runner) provides continuous draining.

**Confidence: HIGH** — Timeout values verified against official Supabase limits docs (free: 150s, paid: 400s). Pattern verified against Supabase Queue consumption docs.

### 2.4 Edge Function Signatures

**`heartbeat-dispatcher/index.ts`** (cron-invoked, no auth header needed):
```typescript
// Invoked by: cron.schedule('heartbeat-dispatcher', '*/5 * * * *', ...)
// No user context — uses service role key
// Returns: { dispatched: number, skipped: number }
```

**`heartbeat-runner/index.ts`** (cron-invoked, no auth header needed):
```typescript
// Invoked by: cron.schedule('heartbeat-runner', '*/30 * * * *', ...)
// Note: '*/30 * * * *' = every 30 minutes in cron syntax
// For every-30-seconds use pg_cron with: cron.schedule('heartbeat-runner', '* * * * *', ...)
// and implement internal throttling, OR accept every-minute frequency
// Returns: { processed: number, surfaced: number, errors: number }
```

**Important cron syntax note:** `pg_cron` minimum granularity is 1 minute (standard cron). For sub-minute polling, use the Supabase Queues `sleep_seconds` parameter and a 1-minute cron that runs a tight internal loop, or accept 1-minute polling frequency (acceptable for a 4-hour heartbeat interval).

### 2.5 Business Hours Enforcement

Enforce in the dispatcher query, not in the runner:

```sql
WHERE heartbeat_enabled = true
  AND next_heartbeat_at <= now()
  AND is_active = true
  AND EXTRACT(HOUR FROM now() AT TIME ZONE user_timezone)
      BETWEEN heartbeat_active_hours_start AND heartbeat_active_hours_end
```

This requires a `timezone` column on `profiles` (already likely present given the existing timezone setting in SettingsPage). The dispatcher skips out-of-window agents rather than dequeueing and suppressing inside the runner — cleaner and cheaper.

---

## 3. Agent Spawner LLM Call

### 3.1 Prompt Structure

The Agent Spawner is called once at onboarding completion. Its job is to produce a ranked JSON array of recommended agent types. Use structured output (JSON mode) to avoid parsing failures.

**System prompt:**
```
You are an AI business analyst. Your job is to recommend which AI specialist agents
from a fixed catalog are most valuable for a specific business.

You must return ONLY a valid JSON array. No explanation text outside the JSON.

Available agent types (fixed catalog):
[INSERT: name, description, key_skills for each of the 12 types as a JSON array]

Business context:
- Business name: {business_name}
- Industry: {industry}
- Location: {location}
- Team size: {team_size}
- Business description: {description}
- Website content summary: {website_summary}
- Primary challenges mentioned: {onboarding_challenges}
```

**User prompt:**
```
Based on this business profile, recommend exactly 5-7 agents from the catalog that will
deliver the highest value. Rank them by expected impact.

Return a JSON array where each item has:
{
  "agent_type_id": "string (must match catalog id exactly)",
  "rank": number (1 = highest impact),
  "why": "string (1-2 sentences, written directly to the business owner, e.g. 'Your e-commerce store will benefit from...')",
  "first_week_value": "string (one concrete thing this agent will do in week 1)"
}

Rules:
- Include 'chief_of_staff' only if NOT already always active (it always is — exclude it)
- Always recommend 'personal_assistant' for solo founders
- Always recommend 'accountant' for product/service businesses with invoicing
- Return between 5 and 7 agents
- Order by rank ascending (rank 1 first)
```

**Why this structure works:**
1. Fixed catalog as JSON in the system prompt means the model cannot hallucinate agent types
2. Strict output format with `agent_type_id` matching catalog IDs prevents invalid selections
3. `why` and `first_week_value` are the copy displayed in the Agent Team Selector UI — writing them in second person eliminates the need for a separate copy-writing step
4. Temperature 0.3: low enough for consistent JSON output, high enough for varied reasoning text

**Confidence: MEDIUM** — Structural reasoning is sound, but exact prompt wording should be iterated on in Phase 1 testing. The JSON-mode approach for agent selection is verified pattern from Supabase + Gemini usage in the codebase.

### 3.2 Edge Function: `agent-spawner`

This is a new edge function called at the end of `planning-agent`'s `initialize` action (or immediately after `onboarding_completed` is set to true).

```
Input:  { user_id }
Action:
  1. Fetch profile + business_artifacts for user_id
  2. Assemble system + user prompt (above)
  3. Call Lovable AI Gateway (model: google/gemini-3-flash-preview, response_format: json_object)
  4. Parse JSON array response
  5. Validate: each agent_type_id must exist in available_agent_types
  6. Insert recommended agents into user_agents (with is_active = false initially)
  7. Return { recommended: AgentRecommendation[] }

Output: { recommended: [{ agent_type_id, rank, why, first_week_value }] }
```

The `is_active = false` flag is key: recommended agents are NOT active until the user accepts them in the Team Selector. This lets the Agent Team Selector UI show the recommendations without the heartbeat system starting to fire on agents the user hasn't approved.

On user acceptance (checkbox → "Accept Team" CTA): frontend calls a simple Supabase update:
```typescript
await supabase
  .from('user_agents')
  .update({ is_active: true })
  .in('id', acceptedUserAgentIds)
```

This triggers the `create_agent_workspace` trigger for each accepted agent.

---

## 4. Onboarding Flow Modification

### 4.1 Minimal Change Principle

The existing `ConversationalOnboarding.tsx` has 11 steps and sets `profiles.onboarding_completed = true` at the end. The Agent Team Selector must be added as a step BEFORE that flag is set, so that:
- The dashboard's onboarding gate (`profiles.onboarding_completed = false` → show wizard) still works
- No new routing or redirect logic is needed
- The user cannot skip the team selector by refreshing mid-onboarding

### 4.2 New Step 12: Agent Team Selector

**Data flow:**

```
Step 11 completes (validators set)
    |
    v
ConversationalOnboarding: set local loading state
    |
    v
supabase.functions.invoke('agent-spawner', { body: { user_id } })
    |
    v
Returns { recommended: [...] }
    |
    v
Render AgentTeamSelectorStep component (inline within the onboarding wizard)
    |
    v
User toggles checkboxes, clicks "Accept Team"
    |
    v
supabase.from('user_agents').update({ is_active: true }).in(...)
    |
    v
supabase.from('profiles').update({ onboarding_completed: true })
    |
    v
Onboarding wizard unmounts, Dashboard renders normally
```

**What does NOT change:**
- The 11 existing onboarding steps
- The `planning-agent` initialization call (it still runs at step 11)
- The onboarding gate check in `Dashboard.tsx`
- `BusinessOnboarding.tsx` (if still used for an alternative flow)

**What changes minimally:**
- `ConversationalOnboarding.tsx`: Add `step === 12` case that renders `AgentTeamSelectorStep`
- Move the `profiles.onboarding_completed = true` write from step 11's completion handler to the "Accept Team" CTA handler
- Insert the 4 default agents (accountant, marketer, sales_rep, personal_assistant) into `user_agents` during `planning-agent` initialize, before spawner runs

### 4.3 Insert Default Agents During Planning-Agent Init

The 4 existing agents must become `user_agents` rows so the heartbeat system can manage them. The `planning-agent` `initialize` action inserts them with `is_active = true` (they're always active, no selection needed):

```typescript
const defaultAgentTypes = ['accountant', 'marketer', 'sales_rep', 'personal_assistant', 'chief_of_staff'];
// INSERT INTO user_agents for each — triggers create_agent_workspace
```

This ensures existing users who completed onboarding before this milestone can be backfilled via a migration that inserts the default `user_agents` rows for them.

---

## 5. React Component Architecture

### 5.1 `AgentMarketplace`

**Location:** `src/components/agents/AgentMarketplace.tsx`
**Registered as:** `activeView === 'marketplace'` in Dashboard.tsx

**Component boundary:**

```
AgentMarketplace
  ├── State: available catalog rows, user's activated agent_type_ids (to show active badge)
  ├── Data: SELECT available_agent_types + user_agents (user_id = current user)
  ├── AgentCatalogCard (12x)
  │     ├── Display: name, description, skills list, activated/not badge
  │     ├── CTA: "Activate" → INSERT user_agents row → triggers workspace creation
  │     └── If activated: "Settings" → navigate to workspace editor view
  └── No AI calls — pure DB read/write
```

**State pattern:** Single `useEffect` on mount fetching both tables in parallel. Local `activating` set to track in-progress activations (prevents double-click). After activation, refetch `user_agents` to update badge states.

---

### 5.2 `AgentWorkspaceEditor`

**Location:** `src/components/agents/AgentWorkspaceEditor.tsx`
**Registered as:** `activeView === 'workspace-{agent_type_id}'` OR as a modal/sheet overlay

**Recommendation:** Use a Sheet (slide-in panel from shadcn/ui) rather than a new `ActiveView` — workspace editing is a context-dependent overlay, not a top-level navigation destination. This avoids polluting the `ActiveView` union with 12 new entries.

```
AgentWorkspaceEditor (Sheet)
  ├── Props: agent_type_id, user_id
  ├── State: selectedFile ('IDENTITY' | 'SOUL' | 'SOPs' | 'HEARTBEAT' | 'TOOLS')
  ├── Data: SELECT agent_workspaces WHERE user_id = X AND agent_type_id = Y
  ├── Tab navigation: 5 editable files (MEMORY excluded from tabs)
  ├── WorkspaceFileEditor
  │     ├── Textarea (markdown-aware, monospace font)
  │     ├── Save button → UPDATE agent_workspaces SET content = $1, updated_at = now()
  │     └── "Reset to default" → SELECT default from available_agent_types, UPDATE workspace
  ├── WorkspaceMemoryViewer (read-only panel, shown separately)
  │     └── Display MEMORY.md content with "Agent-written only" label
  └── HeartbeatConfig (inline section)
        ├── Interval selector (1h, 2h, 4h, 8h, 24h)
        ├── Active hours time range picker
        ├── Enable/disable toggle
        └── Save → UPDATE user_agents SET heartbeat_interval_hours, etc.
```

---

### 5.3 `HeartbeatStatusIndicator`

**Location:** `src/components/agents/HeartbeatStatusIndicator.tsx`
**Used by:** OrgChartView agent cards, individual agent panels

**Design:** A small inline component, not a page. Accepts `userAgentId` as prop.

```
HeartbeatStatusIndicator
  ├── Props: userAgentId, agentTypeId, compact?: boolean
  ├── Data:
  │     last_heartbeat_at (from user_agents row)
  │     most recent agent_heartbeat_log row for this agent
  ├── Render logic:
  │     - No heartbeat ever: grey dot + "Not yet run"
  │     - Last run > 24h ago: yellow dot + "Last: {relative time}"
  │     - Last run recent, no log entry (HEARTBEAT_OK): green dot + "All clear {relative time}"
  │     - Last run recent, log entry exists: amber dot + "Surfaced: {summary truncated}"
  │     - Error log entry: red dot + "Error {relative time}"
  └── Click (if compact=false): opens detail sheet showing recent log entries
```

**State pattern:** Pass `last_heartbeat_at` down from parent (avoid N+1 queries in OrgChartView). The component only queries `agent_heartbeat_log` on demand (click to expand), not on render.

---

### 5.4 `OrgChartView`

**Location:** `src/components/dashboard/OrgChartView.tsx`
**Registered as:** `activeView === 'team'`

**Do NOT use a third-party org chart library.** The org chart for this product is a fixed two-level hierarchy (Chief of Staff at depth 0, up to 12 specialists at depth 1). A Flexbox/CSS Grid layout is simpler, more maintainable, and fully customizable for the heartbeat status indicator integration. Third-party libraries (react-org-chart, react-organizational-chart) add bundle weight and force you into their node rendering APIs.

```
OrgChartView
  ├── Data: SELECT user_agents JOIN available_agent_types (for current user)
  ├── ChiefOfStaffNode (top center)
  │     ├── Avatar + name
  │     ├── HeartbeatStatusIndicator (compact)
  │     └── "Always active" badge
  ├── Connector lines (CSS border-bottom + pseudo-elements, no SVG needed)
  └── SpecialistGrid (flex-wrap row)
        └── AgentOrgCard (1 per active agent)
              ├── Avatar + display_name
              ├── HeartbeatStatusIndicator (compact)
              ├── Last active: {last_heartbeat_at relative time}
              ├── Skills badges (2-3 from agent_type skills array)
              └── "Settings" button → opens AgentWorkspaceEditor sheet
```

**Layout CSS pattern:**
```
Chief of Staff: centered, full-width row
Vertical connector: centered border-left from Chief to grid
Specialists: horizontal flex-wrap, each with a short vertical connector from the line
```

This renders correctly on desktop and degrades gracefully on narrower screens without a library.

---

### 5.5 `AgentTeamSelectorStep` (Onboarding)

**Location:** `src/components/onboarding/AgentTeamSelectorStep.tsx`
**Used by:** `ConversationalOnboarding.tsx` as step 12

```
AgentTeamSelectorStep
  ├── Props: recommendations: AgentRecommendation[], onAccept: (selected: string[]) => void
  ├── State: selectedIds (initialized to all recommended agent_type_ids)
  ├── Header: "Your AI team is ready — {business_name}"
  ├── AgentRecommendationCard (one per recommendation, sorted by rank)
  │     ├── Agent avatar + name
  │     ├── why (copy from spawner output)
  │     ├── first_week_value highlight
  │     ├── Skills badges
  │     └── Checkbox (pre-checked)
  ├── Minimum selection guard: disable "Accept" if < 1 selected
  ├── "Accept Suggested Team" CTA button
  │     └── onClick: calls onAccept(selectedIds)
  └── "Add more later" subtext below CTA
```

---

## 6. Build Order and Phase Dependencies

The following dependency graph determines what must be built before what else can start. This is the critical path for milestone planning.

```
Phase 1: Database Foundation (must be first — everything depends on schema)
  - available_agent_types table + seed data (12 agent type rows with MD templates)
  - user_agents table + RLS
  - agent_workspaces table + RLS + trigger
  - agent_heartbeat_log table + RLS + indexes
  - Update Supabase types.ts

Phase 2: Agent Spawner + Onboarding Tail (depends on Phase 1)
  - agent-spawner edge function
  - Update planning-agent to insert default user_agents rows
  - AgentTeamSelectorStep component
  - Modify ConversationalOnboarding.tsx (add step 12, move onboarding_completed write)

Phase 3: Workspace Editor + Marketplace (depends on Phase 1)
  - AgentWorkspaceEditor component (Sheet)
  - AgentMarketplace component
  - HeartbeatConfig inline section
  - Register new views in Dashboard.tsx sidebar

Phase 4: Heartbeat System (depends on Phase 1 + Phase 3 for HEARTBEAT.md content)
  - heartbeat-dispatcher edge function
  - heartbeat-runner edge function
  - pgmq queue setup (heartbeat_jobs)
  - pg_cron job registrations (dispatcher every 5 min, runner every 1 min)

Phase 5: OrgChart + Status UI (depends on Phase 4 for heartbeat data)
  - OrgChartView component
  - HeartbeatStatusIndicator component
  - Notification delivery integration (email/push for surfaced heartbeats)
```

Phases 2 and 3 can be developed in parallel after Phase 1 completes. Phase 5 can start UI scaffolding in parallel with Phase 4 since it only needs the DB schema (Phase 1), not live heartbeat data.

---

## 7. Data Flow Diagrams

### 7.1 Agent Activation Flow

```
User clicks "Activate" in AgentMarketplace
    |
    v
INSERT user_agents (is_active: true)
    |
    v (Postgres trigger fires synchronously)
create_agent_workspace() copies 6 default MD rows → agent_workspaces
    |
    v
Frontend refetches user_agents to update UI state
    |
    v
AgentMarketplace shows "Active" badge
Sidebar adds new agent entry (if view registration logic checks user_agents)
```

### 7.2 Heartbeat Full Cycle

```
pg_cron fires heartbeat-dispatcher every 5 minutes
    |
    v
Dispatcher queries user_agents WHERE next_heartbeat_at <= now() LIMIT 50
    |
    v
For each: enqueue { user_id, agent_type_id, user_agent_id } to pgmq heartbeat_jobs
UPDATE user_agents SET next_heartbeat_at = now() + interval, last_heartbeat_at = now()
    |
    v
pg_cron fires heartbeat-runner every 1 minute
    |
    v
Runner calls pgmq.read('heartbeat_jobs', n: 5)
    |
    +-- For each message:
    |
    |   Fetch agent_workspaces: HEARTBEAT.md, SOPs.md, MEMORY.md (last 500 chars)
    |   Fetch agent_tasks: last 7 days for this user/agent type
    |   Fetch profiles + business_artifacts (business context)
    |   Assemble system prompt with agent persona (IDENTITY.md + SOUL.md)
    |
    |   Call Lovable AI Gateway (gemini-3-flash-preview)
    |
    |   Response = "HEARTBEAT_OK"?
    |     YES: pgmq.delete(msg_id), no DB write, continue
    |     NO:
    |       INSERT agent_heartbeat_log (surfaced, summary = first 200 chars of response)
    |       If response includes task marker: INSERT agent_tasks
    |       If notification_enabled: send email/push notification
    |       pgmq.delete(msg_id)
```

### 7.3 Workspace Edit Flow

```
User opens AgentWorkspaceEditor sheet for agent X
    |
    v
SELECT agent_workspaces WHERE user_id = $1 AND agent_type_id = $2
(Returns 6 rows — all files loaded once)
    |
    v
User selects IDENTITY tab, edits content, clicks Save
    |
    v
UPDATE agent_workspaces SET content = $1, updated_at = now(), updated_by = 'user'
WHERE user_id = $2 AND agent_type_id = $3 AND file_type = 'IDENTITY'
    |
    v
Local state updated — no full refetch needed (optimistic update on save)
```

---

## 8. Anti-Patterns to Avoid

### One pg_cron job per user per agent
Registering a cron row for every user/agent combination hits pg_cron's practical job limit within hundreds of users. The dispatcher+queue pattern is the correct solution for this scale.

### Storing all 6 MD files in a single JSONB column
Tempting for simplicity, but makes partial updates, triggers, and per-file auditing significantly harder. The per-row model adds zero overhead at this scale and dramatically improves queryability.

### Calling agent-spawner from the client directly
The spawner fetches sensitive business context. It must be an edge function call, not a direct DB query + client-side LLM call. The Lovable API key must not be in the browser.

### Writing HEARTBEAT_OK runs to agent_heartbeat_log
This fills the log table with noise. The `user_agents.last_heartbeat_at` timestamp provides the recency signal the UI needs without logging every quiet run. Only insert log rows for `surfaced` and `error` outcomes.

### Using ActiveView string union for workspace editor navigation
Adding 12 new `workspace-{agent_type_id}` entries to the ActiveView union in Dashboard.tsx creates tight coupling and makes sidebar management complex. Use a Sheet overlay with props instead — workspace editing is a detail view, not a top-level navigation destination.

### Using a third-party org chart library for a two-level hierarchy
The org structure is fixed at 2 levels. A CSS Flexbox layout with border connectors is 30 lines of CSS vs adding a library dependency. Library APIs change, bundle size increases, and node rendering APIs force compromises on the HeartbeatStatusIndicator integration.

---

## Sources

- [Supabase Edge Function Limits](https://supabase.com/docs/guides/functions/limits) — timeout values (150s free, 400s paid, 2s CPU)
- [Supabase Queues: Consuming with Edge Functions](https://supabase.com/docs/guides/queues/consuming-messages-with-edge-functions) — pgmq.read() pattern, batch n parameter
- [Processing Large Jobs with Edge Functions](https://supabase.com/blog/processing-large-jobs-with-edge-functions) — dispatcher + queue fan-out architecture
- [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) — pg_cron + pg_net pattern for cron-to-edge-function invocation
- [pg_net Extension](https://supabase.com/docs/guides/database/extensions/pg_net) — async HTTP from Postgres
- [Supabase PGMQ Extension](https://supabase.com/docs/guides/queues/pgmq) — message queue primitives

---

*Architecture research: 2026-03-12*
