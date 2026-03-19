# Phase 2: Agent Spawner + Team Selector — Research

**Researched:** 2026-03-12
**Domain:** React onboarding flow extension, Supabase Edge Functions (Deno), structured LLM output, animated UI state transitions, Supabase DB insertion with trigger chain
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SPAWN-01 | On onboarding completion, a `spawn-agent-team` edge function analyzes business context and returns a ranked recommended agent list with per-agent reasoning | Edge function pattern from existing codebase; LLM structured output approach documented below |
| SPAWN-02 | Agent Spawner uses structured JSON output (temperature 0.3, response_format: json_object) constrained to catalog agent type IDs | `response_format` not supported on Gemini Flash via Lovable Gateway — use JSON-in-prompt + post-processing guard; pattern documented below |
| SPAWN-03 | Onboarding flow gains Step 12: Agent Team Selector between validator_sales and processing | `nextStep()` array extension pattern documented; Step type union extension approach defined |
| SPAWN-04 | Agent Team Selector displays: (a) default 5 agents pre-checked + locked, (b) AI-recommended pre-checked with reasoning card, (c) remaining unchecked | Component layout pattern using existing shadcn Card, Checkbox, Badge documented below |
| SPAWN-05 | User can accept suggested team in one click or customize before accepting | Single CTA + optional expand pattern; state management via `Set<string>` documented below |
| SPAWN-06 | After team acceptance, 2–3 second animated "Briefing your team on [Business Name]..." screen before dashboard loads | CSS `animate-spin` + `setTimeout` pattern; identical to existing "processing" step approach |
| SPAWN-07 | Activated agents (beyond defaults) inserted as `user_agents` rows; workspaces auto-populated with business-context-aware content via second LLM call | Trigger chain: INSERT → `on_agent_activated` fires → workspaces created from `default_*_md` templates; second LLM call customizes workspace content post-insert |
| TOOLS-01 | Each agent type in `available_agent_types` has a `skill_config` JSONB field listing enabled tool categories | `skill_config` column already exists and is seeded in Phase 1; migration to update values documented |
| TOOLS-02 | `available_agent_types` catalog ships with role-appropriate tool configs | All 13 agents already have `skill_config` seeded in Migration C (`20260312000003_seed_agent_types.sql`); verification pass needed |
| TOOLS-03 | Each agent's TOOLS.md workspace file documents available tools in plain English | `default_tools_md` already seeded per agent; workspace auto-populated by trigger at spawn time; no additional action for already-seeded defaults |
| TOOLS-04 | Orchestrator edge function respects agent tool boundaries when routing tasks | `orchestrator/index.ts` needs agent tool boundary enforcement logic added; pattern documented below |
</phase_requirements>

---

## Summary

Phase 2 is a frontend-heavy phase with one new edge function and two small backend touch-points. The primary work is extending `ConversationalOnboarding.tsx` with a new Step 12 component (`AgentTeamSelector`) that calls the new `spawn-agent-team` edge function, presents the recommendation, and handles the animated briefing screen before handing off to `onComplete()`. The backend work is the `spawn-agent-team` edge function itself (LLM call with catalog-constrained output), plus inserting the accepted agents as `user_agents` rows (which triggers workspace auto-population from Phase 1's trigger).

The Lovable AI Gateway uses Google Gemini 3 Flash Preview. Gemini Flash does not support `response_format: json_object` as a formal parameter through OpenAI-compatible APIs. The correct pattern for this project is to instruct JSON output in the system prompt and validate + filter the response in application code, constraining agent type IDs against the catalog fetched from `available_agent_types` before any DB insert. This prevents hallucinated agent IDs from reaching the database.

The `DashboardSidebar` currently has a static `agentItems` array. To show dynamically activated agents, the sidebar must fetch `user_agents` from Supabase and render the active agents. This is the most impactful architectural change in this phase: the sidebar shifts from static to data-driven. The `ActiveView` type union in `Dashboard.tsx` must also be extended or the sidebar must use a dynamic routing pattern for new agent views.

**Primary recommendation:** Treat Step 12 as a self-contained `<AgentTeamSelector>` component passed the onboarding data (business name, industry, description) as props. Keep `ConversationalOnboarding.tsx` as the orchestrator; delegate all rendering to the new component. The edge function and the briefing animation are called from within `handleTeamAccept()` in that component.

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | Component rendering and state | Project standard |
| TypeScript | 5.8.3 | Type safety | Project standard; `strict: false` already set |
| `@supabase/supabase-js` | 2.86.0 | DB queries + edge function invocation | Project standard |
| `@radix-ui/react-checkbox` | 1.3.2 | Accessible checkbox (used in shadcn `Checkbox`) | Already installed, shadcn wrapper exists |
| `@radix-ui/react-progress` | 1.1.7 | Progress bar for briefing animation | Already installed, shadcn wrapper exists |
| `lucide-react` | 0.462.0 | Icons for agent cards in selector | Already installed |
| `tailwindcss-animate` | 1.0.7 | `animate-in fade-in` CSS classes used in all steps | Already installed |

### No New Dependencies Required

All UI primitives needed for Step 12 (Card, Checkbox, Badge, Button, Progress, ScrollArea) exist in `src/components/ui/`. No npm installs are needed for this phase.

---

## Architecture Patterns

### Recommended File Structure (new files this phase)

```
worrylesssuperagent/
├── src/
│   └── components/
│       └── onboarding/
│           ├── ConversationalOnboarding.tsx   (MODIFY — add step, state, handlers)
│           └── AgentTeamSelector.tsx          (NEW — Step 12 UI component)
├── supabase/
│   └── functions/
│       └── spawn-agent-team/
│           └── index.ts                       (NEW — edge function)
└── supabase/
    └── migrations/
        └── 20260312000005_tools_skill_config.sql  (NEW — update skill_config values if needed)
```

### Pattern 1: Extending the `nextStep()` Step Array

`ConversationalOnboarding.tsx` uses an ordered array of `Step` strings iterated by index. To add Step 12, extend the `Step` type union and insert `"agent_team_selector"` between `"validator_sales"` and `"processing"`.

**Current flow:**
```
validator_sales → processing → complete
```

**New flow:**
```
validator_sales → agent_team_selector → briefing → complete
```

Note: `"briefing"` replaces `"processing"` as the step name for the animation screen (or `"processing"` is reused with new copy), and `onboarding_completed = true` is set AFTER team acceptance, not before.

**CRITICAL TIMING BUG TO AVOID:** Currently `onComplete()` is called and `onboarding_completed = true` is set inside `handleComplete()`, which is triggered by `validator_sales`. After adding Step 12, `handleComplete()` must NOT be called from `validator_sales`. Instead, `validator_sales` calls `nextStep()` and the actual profile update + agent spawning happens in the new `handleTeamAccept()` function. The existing `currentStepNumber` map must be updated to include the new step.

**Type extension:**
```typescript
// Add to Step type union
type Step =
  | "welcome"
  | "business_name"
  | "website"
  | "industry"
  | "location"
  | "description"
  | "meet_team"
  | "validator_personal_assistant"
  | "validator_accountant"
  | "validator_marketer"
  | "validator_sales"
  | "agent_team_selector"   // NEW
  | "briefing"              // NEW (replaces processing for the animated step)
  | "complete";
```

**nextStep array update:**
```typescript
const steps: Step[] = [
  "welcome", "business_name", "website", "industry", "location",
  "description", "meet_team", "validator_personal_assistant", "validator_accountant",
  "validator_marketer", "validator_sales", "agent_team_selector", "briefing"
];
```

### Pattern 2: `spawn-agent-team` Edge Function Structure

**Pattern matches existing edge functions** (`crawl-business-website`, `orchestrator`):

```typescript
// supabase/functions/spawn-agent-team/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const LOVABLE_AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

serve(async (req) => {
  // 1. CORS preflight
  // 2. JWT verification via anon-key client (auth.getUser)
  // 3. Parse body: { businessName, industry, description, location }
  // 4. Fetch catalog from available_agent_types (service-role client)
  // 5. Build VALID_IDS set from catalog (excludes default 5)
  // 6. Call LLM with system prompt instructing JSON output constrained to VALID_IDS
  // 7. Parse LLM response, filter to only IDs in VALID_IDS
  // 8. Return { recommendations: [...] }
});
```

**Two-client pattern** (matches Phase 1 security decision):
```typescript
// anon-key for JWT verification
const supabaseAuth = createClient(url, anonKey, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user }, error } = await supabaseAuth.auth.getUser();

// service-role for DB reads (catalog fetch)
const supabaseAdmin = createClient(url, serviceRoleKey);
```

### Pattern 3: Hallucination-Proof Agent ID Validation

This is the SPAWN-02 requirement. Because Gemini Flash does not support `response_format: json_object`, use prompt-based JSON instruction + post-processing filter:

```typescript
// Step 1: Fetch valid IDs (excluding default 5 which are always activated)
const DEFAULT_AGENT_IDS = new Set([
  'chief_of_staff', 'accountant', 'marketer', 'sales_rep', 'personal_assistant'
]);

const { data: catalog } = await supabaseAdmin
  .from('available_agent_types')
  .select('id, display_name, description, skill_config');

const validAdditionalIds = catalog
  .map(a => a.id)
  .filter(id => !DEFAULT_AGENT_IDS.has(id));

// Step 2: Pass ONLY the valid additional IDs to the LLM in the prompt
const systemPrompt = `You are an agent recommendation engine.
Available agent IDs (ONLY use these exact strings):
${validAdditionalIds.join(', ')}

Return ONLY valid JSON in this format:
{
  "recommendations": [
    {
      "agent_type_id": "exact_id_from_list_above",
      "reasoning": "one sentence why this fits the business",
      "first_week_value": "what they will do in week one"
    }
  ]
}`;

// Step 3: Parse + filter response
const parsed = JSON.parse(llmResponseText);
const safeRecommendations = (parsed.recommendations || [])
  .filter(r => validAdditionalIds.includes(r.agent_type_id))
  .slice(0, 5); // Cap at 5 recommendations
```

### Pattern 4: `AgentTeamSelector` Component Data Model

```typescript
interface AgentRecommendation {
  agent_type_id: string;
  display_name: string;
  description: string;
  skill_config: string[];
  reasoning: string;         // from LLM
  first_week_value: string;  // from LLM
  isDefault: boolean;
  isRecommended: boolean;
}

// State in ConversationalOnboarding:
const [agentRecommendations, setAgentRecommendations] = useState<AgentRecommendation[]>([]);
const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
const [isFetchingTeam, setIsFetchingTeam] = useState(false);
```

**Checkbox state rules:**
- Default 5 agents: `checked={true}`, `disabled={true}` — always activated, not togglable
- AI-recommended agents: `checked={true}` initially (pre-checked), `disabled={false}` — user can uncheck
- Remaining catalog agents: `checked={false}` initially, `disabled={false}` — user can check

### Pattern 5: Briefing Animation Screen

The existing "processing" step uses `Loader2` + `Progress` + `statusMessage`. The briefing step is identical in structure but shows a different message:

```typescript
case "briefing":
  return (
    <div className="text-center space-y-6 animate-in fade-in duration-300">
      <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">
          Briefing your team on {businessName}...
        </h2>
        <p className="text-muted-foreground">
          Your AI employees are getting up to speed
        </p>
      </div>
      <Progress value={briefingProgress} className="h-2 w-full max-w-xs mx-auto" />
    </div>
  );
```

The `handleTeamAccept()` function: (1) sets step to "briefing", (2) inserts `user_agents` rows for selected non-default agents, (3) triggers optional second LLM call for business-context workspace customization (SPAWN-07), (4) after 2–3 seconds calls `onComplete()`.

### Pattern 6: Dashboard Sidebar — Dynamic Agent Loading

**Current state:** `agentItems` is a static hardcoded array with 5 agents.

**Required change for Phase 2:** The sidebar must reflect the dynamically activated team. This requires:

1. `DashboardSidebar` must accept `userAgents` as a prop OR fetch them internally.
2. `Dashboard.tsx` fetches `user_agents` joined to `available_agent_types` on load.
3. New agents appear as sidebar items alongside the original 4 (personal_assistant, accountant, marketer, sales_rep).

**Minimal approach (recommended for Phase 2):** Pass `activeAgents` array from `Dashboard.tsx` to `DashboardSidebar` as a prop. `Dashboard.tsx` fetches once on mount and refreshes after onboarding completes.

**CRITICAL:** `ActiveView` in `Dashboard.tsx` is currently a closed union type:
```typescript
export type ActiveView = "overview" | "accountant" | "marketer" | "sales" | "assistant" | "chat" | "settings" | "artifacts";
```

New agent views for the 8 additional agent types do not have dedicated UI panels yet. For Phase 2, new agents should route to a generic `AgentChatView` component that renders a simple chat interface for that specific agent type. The `ActiveView` type can be extended to include a dynamic string case OR a separate `activeAgentTypeId` state is used alongside `ActiveView`.

**Recommended extension approach:**
```typescript
// Dashboard.tsx
export type ActiveView =
  | "overview" | "accountant" | "marketer" | "sales" | "assistant"
  | "chat" | "settings" | "artifacts"
  | `agent:${string}`;  // dynamic agent views: "agent:legal_compliance", etc.
```

### Pattern 7: SPAWN-07 — Business-Context Workspace Customization

After inserting `user_agents` rows (which triggers workspace auto-population with generic defaults from Phase 1), a second LLM call can personalize the IDENTITY.md for each newly activated agent with the actual business context.

**Approach:** Do this inside the `spawn-agent-team` function OR as a separate `personalize-agent-workspaces` function called after successful `user_agents` insertion. Given the 2–3 second briefing animation, doing it synchronously inside `spawn-agent-team` and awaiting all personalizations is risky for latency. Recommended pattern: fire-and-forget in the edge function after returning the activation confirmation. The trigger has already created the workspace rows; personalization is an UPDATE, not an INSERT.

```typescript
// After inserting user_agents, trigger personalization asynchronously
// using EdgeRuntime.waitUntil() or by returning early and running in background
```

**Scope decision for Phase 2:** SPAWN-07 specifically says "business-context-aware content via a second LLM call." Given latency constraints, this second call should UPDATE the IDENTITY.md and SOUL.md for each newly activated agent replacing `{business_name}` placeholder tokens with the actual business context. This is a targeted text replacement, not a full workspace regeneration.

### Anti-Patterns to Avoid

- **Setting `onboarding_completed = true` before Step 12:** The current `handleComplete()` sets this flag and then calls `onComplete()`. In Phase 2, `onboarding_completed = true` must only be set AFTER the user accepts the team (inside `handleTeamAccept`), not when `validator_sales` fires.
- **Calling `spawn-agent-team` before validator_sales completes:** The edge function needs business context that comes from earlier onboarding steps. Call it when entering Step 12 (in a `useEffect` keyed on step === "agent_team_selector").
- **Passing `userId` in the request body to edge functions:** Per Phase 1 SEC-01 decision, userId must come from JWT verification inside the function, not from the client body. `spawn-agent-team` must follow this pattern.
- **Inserting default 5 agents again:** The backfill migration (Migration D) already inserted default agents for existing users. For new users, the Phase 2 insertion only adds the SELECTED non-default agents. The `UNIQUE(user_id, agent_type_id)` constraint on `user_agents` prevents duplicates, but the code should proactively exclude default IDs.
- **Static `agentItems` array causing stale sidebar after onboarding:** After `onComplete()` fires, the `Dashboard.tsx` needs to refetch `user_agents` so the sidebar reflects the newly activated team. A simple approach: in `Dashboard.tsx`, add `userAgents` to state and call a `refetchUserAgents()` function inside the `onComplete` callback.
- **Template literal `ActiveView` breaking existing switch/case:** If using `agent:${string}`, existing `switch (activeView)` blocks need a `default` case that handles the dynamic pattern. The existing code already has a `default` fallback in `renderContent()`, so this is safe.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible checkbox with indeterminate state | Custom div-based toggle | `src/components/ui/checkbox.tsx` (Radix) | Keyboard nav, ARIA, already installed |
| Progress bar animation | CSS width transition manually | `src/components/ui/progress.tsx` | Handles animation, already installed |
| Scroll container for agent list | `overflow-y: scroll` div | `src/components/ui/scroll-area.tsx` | Cross-browser scrollbar styling |
| Agent card layout | Raw flex divs | `src/components/ui/card.tsx` (Card, CardContent, CardHeader) | Consistent visual language with rest of app |
| Badge for "Default" / "Recommended" labels | Styled span | `src/components/ui/badge.tsx` | Already installed, consistent styling |
| Toast notification after team activation | Alert div | `useToast()` hook | Already used throughout onboarding |
| Edge function CORS | Manual header building | Existing `corsHeaders` object pattern | Copy from any existing edge function |
| LLM call | Custom fetch wrapper | Existing `LOVABLE_AI_GATEWAY` + `DEFAULT_MODEL` constants | Pattern established in 12 existing functions |

---

## Common Pitfalls

### Pitfall 1: Gemini Flash Ignores `response_format` Parameter
**What goes wrong:** Passing `response_format: { type: "json_object" }` in the request body to the Lovable AI Gateway using Gemini Flash — the parameter is silently ignored and the model may return markdown-wrapped JSON (` ```json ... ``` `).
**Why it happens:** `response_format` is an OpenAI-specific parameter. Gemini's native API uses `generationConfig.responseMimeType`. The Lovable Gateway does not translate this.
**How to avoid:** Instruct JSON output in the system prompt ("Return ONLY valid JSON, no markdown, no prose"). After getting the response, strip markdown code fences before `JSON.parse()`. Use a try/catch around the parse and return an empty recommendations array on failure.
**Warning signs:** `JSON.parse()` throwing `SyntaxError: Unexpected token ````.

```typescript
// Safe JSON extraction from LLM response
function extractJson(raw: string): string {
  const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return stripped;
}
```

### Pitfall 2: `validator_sales` Step Still Calls `handleComplete()`
**What goes wrong:** In the current codebase, the Continue button for `validator_sales` is wired to `handleComplete()`, not `nextStep()`. If this is not changed, the old flow runs (setting `onboarding_completed = true` and calling `onComplete()`) and Step 12 is never reached.
**How to avoid:** Change `validator_sales` button handler from `handleComplete` to `nextStep`. Move ALL profile-update and edge-function logic into the new `handleTeamAccept()` function.

### Pitfall 3: Race Condition Between `user_agents` Insert and Workspace Trigger
**What goes wrong:** The React code inserts `user_agents` rows and immediately assumes workspaces exist (e.g., tries to read them). The Postgres trigger `on_agent_activated` fires synchronously during the INSERT, so workspaces ARE created within the same transaction. There is no race condition for reads that happen after the INSERT completes.
**Why it matters:** This is safe. Document it so Phase 3 developers don't add unnecessary polling. The trigger is synchronous, not a background job.

### Pitfall 4: `ActiveView` Type Union Not Extended for New Agents
**What goes wrong:** A new agent (e.g., `legal_compliance`) is activated and appears in the sidebar. Clicking it calls `onViewChange("agent:legal_compliance")`. TypeScript complains because `"agent:legal_compliance"` is not in the `ActiveView` union. Build fails.
**How to avoid:** Extend `ActiveView` to include a string template literal type OR use a union with `string`. Since the project has `strict: false` and `noImplicitAny: false`, a `string` extension will not break anything. A clean approach: `export type ActiveView = "overview" | ... | "artifacts" | string;`

### Pitfall 5: Default Agents Shown Twice in Sidebar
**What goes wrong:** `DashboardSidebar` renders both the hardcoded `agentItems` array AND the dynamic `user_agents` query result. Default agents (accountant, marketer, etc.) appear twice in the sidebar.
**How to avoid:** If making the sidebar dynamic, REMOVE the hardcoded `agentItems` array entirely and replace with the DB-driven list. The DB query for `user_agents` returns all activated agents including defaults. Map the existing `ActiveView` IDs to agent_type_id values correctly:
  - `"assistant"` view → `agent_type_id = "personal_assistant"`
  - `"accountant"` view → `agent_type_id = "accountant"`
  - `"marketer"` view → `agent_type_id = "marketer"`
  - `"sales"` view → `agent_type_id = "sales_rep"`
  - `"chat"` view → `agent_type_id = "chief_of_staff"`

### Pitfall 6: LLM Latency Blocking Entry to Step 12
**What goes wrong:** The user clicks "Complete Setup" on `validator_sales` and waits 5–10 seconds for the LLM call to finish before seeing Step 12.
**How to avoid:** Trigger the `spawn-agent-team` edge function call when the user enters Step 12 (via `useEffect`), show a loading skeleton while waiting, and render the selector UI once the response arrives. Do NOT await the call inside `nextStep()`.

### Pitfall 7: `user_agents` Insert Fails for Default Agents Already Inserted by Backfill
**What goes wrong:** Code tries to INSERT `user_agents` rows for `chief_of_staff`, `accountant`, etc. for a new user, but the backfill migration already inserted them.
**Clarification:** The backfill only runs for users where `onboarding_completed = true`. New users completing onboarding will NOT have had the backfill run for them (they were not yet in the DB when the migration ran). However, the code must NOT INSERT default agents again — they should be inserted as part of the trigger chain when `onboarding_completed` is first set. Phase 2 should only INSERT the additional selected agents beyond the defaults.
**How to avoid:** The edge function or client code should filter: only insert agent_type_ids that are NOT in `['chief_of_staff', 'accountant', 'marketer', 'sales_rep', 'personal_assistant']`. The `UNIQUE(user_id, agent_type_id)` constraint serves as a safety net but should not be relied upon as the primary guard.

**WAIT — CRITICAL CLARIFICATION:** Looking at the Phase 1 backfill migration more carefully, it inserts the default 5 agents only for users where `onboarding_completed = true`. For brand new users going through onboarding right now, `onboarding_completed` is still `false` — so the backfill would NOT have inserted their defaults. This means for new users, the FIRST user_agents inserts must include the defaults too. The correct sequence in `handleTeamAccept()`:
1. INSERT the default 5 agents for this new user
2. INSERT any additionally selected agents
3. Set `onboarding_completed = true`

The `UNIQUE` constraint makes all these idempotent.

---

## Code Examples

### Edge Function: Full Request/Response Shape

```typescript
// Request body (from client)
{
  businessName: string;
  industry: string;
  description: string;
  location: string;   // "City, Country"
}

// Response body (from edge function)
{
  recommendations: Array<{
    agent_type_id: string;       // guaranteed to be in catalog
    reasoning: string;           // why this agent fits
    first_week_value: string;    // what they'll do in week 1
  }>;
  allAgents: Array<{             // full catalog for rendering "rest" section
    id: string;
    display_name: string;
    description: string;
    skill_config: string[];
  }>;
}
```

### Client-Side: Calling `spawn-agent-team` from `useEffect`

```typescript
useEffect(() => {
  if (step !== "agent_team_selector") return;
  if (agentRecommendations.length > 0) return; // already fetched

  setIsFetchingTeam(true);
  supabase.functions.invoke('spawn-agent-team', {
    body: { businessName, industry, description, location: `${city}, ${country}` }
  }).then(({ data, error }) => {
    if (error) {
      toast({ title: "Couldn't load team recommendations", variant: "destructive" });
      // Fall through with empty recommendations — user can still proceed with defaults
    } else {
      setAgentRecommendations(data.recommendations);
      // Pre-check recommended IDs
      const recommended = new Set(data.recommendations.map(r => r.agent_type_id));
      setSelectedAgentIds(recommended);
    }
    setIsFetchingTeam(false);
  });
}, [step]);
```

### Client-Side: `handleTeamAccept()` Sequence

```typescript
const handleTeamAccept = async () => {
  setStep("briefing");
  setBriefingProgress(10);

  try {
    // 1. Insert default 5 agents (for new users; UNIQUE constraint makes it idempotent)
    const DEFAULT_IDS = ['chief_of_staff', 'accountant', 'marketer', 'sales_rep', 'personal_assistant'];
    for (const agentTypeId of DEFAULT_IDS) {
      await supabase.from('user_agents').upsert(
        { user_id: userId, agent_type_id: agentTypeId },
        { onConflict: 'user_id,agent_type_id', ignoreDuplicates: true }
      );
    }

    setBriefingProgress(40);

    // 2. Insert selected additional agents
    const additionalIds = Array.from(selectedAgentIds).filter(id => !DEFAULT_IDS.includes(id));
    for (const agentTypeId of additionalIds) {
      await supabase.from('user_agents').upsert(
        { user_id: userId, agent_type_id: agentTypeId },
        { onConflict: 'user_id,agent_type_id', ignoreDuplicates: true }
      );
    }

    setBriefingProgress(70);

    // 3. Update profile with onboarding_completed = true
    await supabase.from('profiles').update({
      business_name: businessName,
      industry,
      country,
      city,
      company_description: description,
      onboarding_completed: true,
    }).eq('user_id', userId);

    setBriefingProgress(100);

    // 4. Hold for briefing animation (2–3 seconds total)
    await new Promise(resolve => setTimeout(resolve, 2000));
    onComplete();

  } catch (error) {
    toast({ title: "Setup failed", description: error.message, variant: "destructive" });
    setStep("agent_team_selector"); // Go back
  }
};
```

### Sidebar: Dynamic Agent Query

```typescript
// In Dashboard.tsx
const [userAgents, setUserAgents] = useState([]);

const fetchUserAgents = async () => {
  if (!user) return;
  const { data } = await supabase
    .from('user_agents')
    .select('agent_type_id, available_agent_types(id, display_name, description)')
    .eq('user_id', user.id)
    .eq('is_active', true);
  setUserAgents(data || []);
};

useEffect(() => { fetchUserAgents(); }, [user]);
```

### TOOLS-04: Orchestrator Tool Boundary Enforcement

The `orchestrator/index.ts` already has agent-specific system prompts. Tool boundary enforcement means: when routing a task to an agent, include in the routing context a list of that agent's `skill_config` values, and add an explicit prohibition for tools not in the agent's skill set.

The `available_agent_types.skill_config` column is already seeded with role-appropriate tool arrays. The orchestrator can fetch the target agent's `skill_config` from the catalog and include it in the delegated prompt:

```typescript
// Fetch target agent's skill_config
const { data: agentType } = await supabaseAdmin
  .from('available_agent_types')
  .select('skill_config')
  .eq('id', targetAgentType)
  .single();

const allowedTools = agentType?.skill_config || [];
const systemPromptAddendum = `
TOOL BOUNDARIES: You are only permitted to use tools in this list: ${allowedTools.join(', ')}.
Do not attempt invoice functions unless "invoice_parsing" is in your list.
Do not write to calendar unless "calendar_management" is in your list.
`;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static 4-agent sidebar | Dynamic user_agents-driven sidebar | Phase 2 | Sidebar shows real activated team |
| Onboarding ends at validator_sales | Onboarding has Step 12 team selector | Phase 2 | Users get curated team before dashboard |
| Default agents inserted by backfill | Default agents inserted during onboarding completion | Phase 2 | Clean activation path for all new users |
| Generic workspace defaults | Business-context workspace content (SPAWN-07) | Phase 2 | Agents know the business from day one |

**Deprecated/outdated after Phase 2:**
- The hardcoded `agentItems` array in `DashboardSidebar.tsx` — replaced by dynamic DB query
- The `handleComplete()` call inside `validator_sales` button — replaced by `nextStep()` + separate `handleTeamAccept()`
- The step number display "Step X of 9" in validator steps — must be updated to "Step X of 11" (or hidden) to account for new steps

---

## Open Questions

1. **Should `spawn-agent-team` also handle default-5 insertion, or is that purely client-side?**
   - What we know: The edge function has service-role access and can do DB writes. The client also has direct Supabase access.
   - What's unclear: Whether the team-acceptance DB writes should happen server-side (in the edge function) or client-side.
   - Recommendation: Keep it client-side for Phase 2 (simpler, faster, consistent with how existing onboarding writes work). The edge function's job is LLM recommendation only. DB writes happen in `handleTeamAccept()` client-side.

2. **How should new agent views work in the dashboard for Phase 2?**
   - What we know: The 4 default agents have dedicated React component panels (AccountantAgent, MarketerAgent, etc.). The 8 additional agents have no panel yet.
   - What's unclear: Whether Phase 2 should build generic panels for all 8 new agents or just show a placeholder/chat.
   - Recommendation: Create a single `GenericAgentPanel` component that shows the agent's name, description, and a chat interface. Reuse `ChatInterface` with the agent_type_id as context. Full custom panels per agent are Phase 3+ scope.

3. **Does SPAWN-07 require workspace personalization to complete before `onComplete()` fires?**
   - What we know: The briefing animation runs 2–3 seconds. Personalizing 5+ workspace IDENTITY.md files via separate LLM calls could take 5–15 seconds total.
   - What's unclear: UX expectation — should users see personalized workspaces immediately on first dashboard load?
   - Recommendation: For Phase 2, do NOT block `onComplete()` on workspace personalization. Do a fire-and-forget UPDATE after inserting `user_agents`. The workspace is already functional with default content. Personalization is a bonus that can complete in the background.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test config files or test directories in the project |
| Config file | None — Wave 0 must create |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPAWN-01 | `spawn-agent-team` returns ranked recommendations with reasoning | manual-only | — | Wave 0 gap |
| SPAWN-02 | Only valid catalog IDs appear in response; hallucinated IDs are filtered | unit | `deno test supabase/functions/spawn-agent-team/spawn.test.ts` | Wave 0 gap |
| SPAWN-03 | Onboarding flow renders Step 12 after validator_sales | manual-only | — | — |
| SPAWN-04 | Default 5 agents pre-checked + locked; recommended pre-checked; rest unchecked | manual-only | — | — |
| SPAWN-05 | "Accept Suggested Team" activates exactly the checked agents | manual-only | — | — |
| SPAWN-06 | Briefing animation runs 2–3 seconds before `onComplete()` | manual-only | — | — |
| SPAWN-07 | `user_agents` rows inserted; workspaces exist after trigger | integration | Supabase DB query verification | Wave 0 gap |
| TOOLS-01 | `available_agent_types.skill_config` not empty for all 13 rows | integration | SQL: `SELECT id FROM available_agent_types WHERE skill_config = '[]'` | Via Supabase Studio |
| TOOLS-02 | Role-appropriate tool configs present per agent | manual-only | — | — |
| TOOLS-03 | TOOLS.md workspace file populated for each activated agent | integration | SQL verify | Via Supabase Studio |
| TOOLS-04 | Orchestrator respects tool boundaries in routing | manual-only | — | — |

**Note:** This project has no test framework installed. The Deno edge functions can run unit tests with the native `deno test` command. React component tests would require Vitest + @testing-library/react setup.

### Sampling Rate
- **Per task commit:** Manual review in browser dev environment
- **Per wave merge:** SQL queries in Supabase Studio to verify `user_agents` + `agent_workspaces` rows
- **Phase gate:** Full manual walkthrough of onboarding → Step 12 → dashboard with all agents visible in sidebar

### Wave 0 Gaps
- [ ] No test framework installed — project ships without automated tests; no Wave 0 test setup required unless team decides to add Vitest
- [ ] SQL verification script for SPAWN-07: check that `user_agents` insert creates 6 `agent_workspaces` rows via trigger

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `ConversationalOnboarding.tsx` (full file read)
- Direct codebase inspection — `Dashboard.tsx` (full file read)
- Direct codebase inspection — `DashboardSidebar.tsx` (full file read)
- Direct codebase inspection — `supabase/functions/crawl-business-website/index.ts` (pattern for JWT + two-client + LOVABLE_AI_GATEWAY)
- Direct codebase inspection — `supabase/migrations/20260312000001_create_agent_tables.sql` (schema)
- Direct codebase inspection — `supabase/migrations/20260312000003_seed_agent_types.sql` (catalog + skill_config values)
- Direct codebase inspection — `supabase/migrations/20260312000004_backfill_existing_users.sql` (default agents list)
- Direct codebase inspection — `supabase/functions/_shared/sanitize.ts` (shared module pattern)
- Direct codebase inspection — `package.json` (installed dependencies)
- `.planning/REQUIREMENTS.md`, `PROJECT.md`, `ROADMAP.md`, `STATE.md` — authoritative spec

### Secondary (MEDIUM confidence)
- Gemini Flash + response_format behavior: inferred from Gemini API documentation knowledge (no `json_object` mode in native Gemini; Lovable Gateway does not translate this parameter). Confidence: MEDIUM — verified by reasoning about Gemini native API vs OpenAI compatibility layer.

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as installed in `package.json`
- Architecture: HIGH — based on direct file inspection of existing patterns
- Pitfalls: HIGH — all pitfalls derived from specific lines of existing code (not speculation)
- Gemini `response_format` claim: MEDIUM — based on API documentation knowledge, not live test

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable stack; 30-day validity)
