# Feature Landscape

**Domain:** Multi-agent business automation SaaS — Agent Spawner, MD Workspace, Heartbeat, Role Tooling, Org View
**Milestone:** Agent team management layer on top of existing Worryless AI platform
**Target User:** Non-technical entrepreneurs and small business operators (2–10 person teams)
**Researched:** 2026-03-12

---

## Research Scope

This document covers five research questions:
1. What features do successful AI agent platforms offer for team/org management that users love?
2. What are table-stakes UX patterns for "agent onboarding" / team setup flows?
3. How do proactive notification systems handle surfacing insights without creating notification fatigue?
4. What makes an agent "feel alive" to non-technical users — what UI patterns signal active work?
5. What are the best patterns for editable markdown/text config files in web UIs?

---

## Q1: AI Agent Platform Team/Org Management — What Users Love

### What Competitors Do Well

**Lindy AI (3.0)** — "AI employee" framing with Team Accounts:
- Centralized agent deployment: admins push a proven agent to the entire org with one action
- Shared agent library: one "sales outreach" agent deployed to all sales reps; same brand voice everywhere
- Monitoring per agent: activity logs, credit usage, what each agent touched
- Autonomy levels: Observe & Suggest → Plan & Propose → Act with Confirmation → Act Autonomously (four-tier dial)
- Agents are described by what they *do* ("updates spreadsheets, sends outreach, monitors systems") not what they *are* — this shifts user mental model from "software" to "employee"
- HIGH confidence — from Lindy's own blog post

**Relevance AI** — Role-scoped agents for GTM teams:
- Pre-built role templates (BDR Agent, Research Agent, Inbound Qualification Agent) that users activate rather than build from scratch — reduces cognitive load
- Full version history on every agent with one-click rollback — trust safety net
- Role-based access control: different team members see different agents based on their function
- Agent-to-agent delegation within a "team" object — agents hand off work internally
- MEDIUM confidence — from G2 reviews and platform docs

**AutoGen Studio (v0.4)** — Technical but instructive:
- Visual team builder: drag nodes for agents, connect them with delegation arrows — makes org hierarchy tangible
- Real-time message graph: as agents respond, each step is visualized as a node in a control-flow graph with token usage — transforms invisible processing into observable activity
- Editable node properties: click any agent node in the graph → side panel with editable configuration
- HIGH confidence — from Microsoft AutoGen official docs

**AgentOps** — Monitoring layer:
- Replay Analytics: step-by-step execution graphs users can scrub through like a timeline
- Per-agent performance dashboard: task completion rate, latency, cost per run
- MEDIUM confidence — from AgentOps official docs

### Synthesis for Worryless AI

Users love these patterns:
1. **Role-framed agent cards** — "Your Marketing Manager" not "marketingAgent_v2"
2. **Activation not configuration** — pre-built templates they switch on; no blank-canvas setup
3. **Visible activity logs** — seeing what the agent did last, with timestamps
4. **Autonomy controls per agent** — granular trust setting, not one global setting
5. **Team-level view** — a single screen showing all active agents and their last action

---

## Q2: Table-Stakes UX for "Agent Onboarding" / Team Setup Flows

### The Core Pattern: Recommendation + Reasoning + Acceptance

Research consistently shows that presenting users with AI-generated recommendations (rather than asking them to configure from scratch) is the primary trust lever. The specific pattern that works:

**Step 1 — Recommendation reveal (not a form)**
Show a visually distinct "Your Recommended Team" screen at the end of onboarding, not a settings page. The reveal moment should feel like meeting a new team, not filling in a form. Users are most primed for acceptance immediately after completing onboarding — context is fresh, engagement is peak.

**Step 2 — Reasoning cards per agent (not just a list)**
Each recommended agent must show a one-sentence "Why this agent" tied to the user's own onboarding answers. "You mentioned scaling your social presence — your Marketing Manager will handle content scheduling and brand consistency." This closes the loop: the system *listened*, therefore users trust the recommendation.
- MEDIUM confidence — from agentic UX pattern research (Smashing Magazine, UXMag)

**Step 3 — Checkbox acceptance with defaults pre-checked**
Pre-check all recommended agents. Users feel positive momentum ("accept everything" is easy). Unchecking is a deliberate opt-out, not an opt-in. Include a "Why is this checked?" tooltip per agent.

**Step 4 — Prominent single CTA**
One button: "Activate My Team" or "Meet My Team". Not "Save", not "Continue". The language should complete the metaphor — they are *activating employees*, not configuring software.

**Step 5 — Post-acceptance onboarding moment (the handshake)**
Immediately after acceptance, show a brief "Your team is getting briefed on [Business Name]" loading state with agent avatars. This 2–3 second moment is the most important animation in the product — it signals the system has *internalized* the user's business context. Never skip it.

### Autonomy Dial — Build It In From The Start

The research from Smashing Magazine (February 2026) is definitive: agentic UX must offer a multi-tier autonomy setting. For Worryless AI, this maps to:

| Tier | Label | Behavior |
|------|-------|----------|
| 1 | "Suggest" | Heartbeat surfaces findings; user always approves actions |
| 2 | "Confirm" | Agent drafts and schedules; user approves before send/run |
| 3 | "Autopilot" | Agent acts within approved SOP boundaries; user gets post-action notification |

Default all new users to "Confirm" (tier 2). Never default to "Autopilot" — this is a trust violation for new users. The validator system already in the codebase maps directly to tiers 1 and 2.

### Intent Preview Before Any Action

Before any agent executes a high-impact action (send email, create invoice, post content), show a sequential plan: "I will do X, then Y, then Z." Give the user Proceed / Edit / Handle Myself options. This single pattern resolves the most common complaint about AI agents: surprise outputs.
- HIGH confidence — Smashing Magazine Feb 2026 article, verified as authoritative

### What NOT to Do

- Do not show a blank agent configuration form after onboarding — cognitive overload, drop-off guaranteed
- Do not require the user to pick from a full catalog first — recommendations must come before browsing
- Do not make "Skip all" the easiest action — friction at this step is acceptable and desirable

---

## Q3: Proactive Notifications — Surfacing Insights Without Fatigue

### The Core Problem

More than one-third of employees feel overwhelmed by notification volume; over half feel pressured to respond immediately. For Worryless AI's heartbeat system, this is an existential risk — if heartbeats generate noise, users disable them, and the product's core value proposition dies.

### The Pattern That Works: Digest + Smart Suppression + User Control

**Pattern 1: Strict suppression at the source (HEARTBEAT_OK)**
The architecture decision already in PROJECT.md — suppress HEARTBEAT_OK runs entirely — is the correct call. Never notify unless there is genuine signal. The product should be proud of *not* notifying. "Your team ran 47 checks today. Nothing needed your attention." This is a feature, not a failure.

**Pattern 2: Digest instead of real-time push**
Slack AI's digest pattern is instructive: instead of per-event pushes, surface a single "Morning Briefing" from the Chief of Staff agent that synthesizes what all agents found overnight. 1–3 items maximum. Users who receive 1–3 targeted notifications per day show up to 20% higher engagement vs. users who receive zero or excessive notifications (multiple sources confirm this range).

**Pattern 3: User control over timing and channels**
61% of users will continue using an app if notifications follow their preference settings (MagicBell research). Build per-agent notification settings from day one:
- Notification channel: in-app only / email / both
- Frequency: digest (morning briefing) / real-time when urgent
- Active hours: which hours are acceptable for interruptions
- Enable/disable per agent

This is not a nice-to-have. Users who cannot control their notifications churn. Users who can control them stay.

**Pattern 4: Severity tiering**
Not all heartbeat findings are equal. Use three tiers:
- **Urgent** (red): Requires action today — invoice overdue, compliance deadline in 48h
- **Heads-up** (amber): Worth knowing but not urgent — lead went cold, content queue is empty
- **Digest** (grey): Background info, surface in weekly summary only

Only Urgent notifications should trigger push/email. Heads-up and Digest appear in-app when the user visits. This eliminates the most common source of notification fatigue.

**Pattern 5: Explain why you're notifying**
Every notification must have a one-sentence rationale tied to the user's own SOPs or business context. "Your Accounts Receivable agent flagged Invoice #142 — payment is 14 days overdue against your 30-day payment policy." Vague notifications ("Something needs your attention") destroy trust and get disabled within days.

### What to Explicitly NOT Build

- Do not send a notification every time an agent completes a routine task — this is noise
- Do not default email notifications to "all heartbeat findings" — users will unsubscribe and lose high-value alerts
- Do not send notifications outside business hours unless Urgent and the user has opted into it

---

## Q4: Making an Agent "Feel Alive" — UI Patterns for Non-Technical Users

### The Problem

For entrepreneurs, an agent that silently processes and returns a result feels like software. An agent that visibly thinks, reports, and checks in feels like an employee. The "wow" moment comes from the second experience.

### Pattern 1: Streaming Status Labels (Not Spinners)

Replace generic loading spinners with specific, changing status labels that update every 1–3 seconds:
- "Reviewing your recent invoices..."
- "Cross-referencing with last month's data..."
- "Drafting your cashflow summary..."

This costs near-zero engineering effort (update a status string in state) and fundamentally changes the perceived intelligence of the system. AutoGen Studio does this via real-time message streaming to a graph view. Worryless AI should do it via a text status label in the agent chat header.

### Pattern 2: Last Activity Timestamp + Mini Activity Log

Every agent card in the Team view should show:
- A pulsing green dot when the heartbeat ran in the last 4 hours
- "Last active: 2 hours ago" with a one-line description of what the agent last did
- On expand: last 5 activities with timestamps

This transforms the org chart from a static directory into a living dashboard. Lindy does this at the team level; AutoGen does it per-agent in the graph view.

### Pattern 3: Agent Avatars with Personality, Not Robot Icons

Each agent type should have a unique visual identity: consistent avatar/icon, a name that feels like a person (not a system), and a short tagline ("Keeps your books clean so you don't have to"). Non-technical users anthropomorphize AI agents aggressively — lean into this, don't fight it. Lindy's "AI employee" framing confirms this works at scale.

### Pattern 4: Proactive Nudge Moments (The Highlight Reel)

When a heartbeat surfaces something meaningful, the notification should not just say "found something." It should open with the finding in the agent's voice: "I noticed your lead pipeline has gone quiet — no new leads in 5 days. Want me to run a fresh search?" This is the difference between a dashboard alert and a colleague tapping you on the shoulder.

### Pattern 5: Thought Log / Reasoning Trail

For non-routine agent outputs, show a collapsible "How I got here" section:
- The sources consulted (SOPs checked, memory references, tools called)
- The reasoning step that triggered the output

Keep it one level deep — entrepreneurs don't want to audit every decision, but they want to know the option exists. This builds trust faster than any feature except the one above.

### Pattern 6: The MEMORY.md Progression Signal

MEMORY.md is agent-written and grows over time. Surface this in the UI: "Your Sales Rep has learned 12 things about your business since joining." This communicates that the agent is getting smarter, which is one of the most powerful "feels alive" signals available. Show the count, not the contents (MEMORY.md is read-only in the UI per spec).

### The "Wow Moment" Path for a Non-Technical Entrepreneur

1. Completes onboarding → sees animated team activation → "these agents know my business"
2. Returns next morning → sees morning briefing from Chief of Staff → "it worked while I slept"
3. Clicks into Sales Rep → sees "Last active: 3 hours ago — ran a lead search, found 4 new prospects" → "it actually did something"
4. Reads the heartbeat finding in the Sales Rep's voice → "this feels like talking to a person"

Every one of these moments is achievable with the existing architecture. None requires new infrastructure.

---

## Q5: Editable Markdown/Text Config Files in Web UIs

### Recommendation: CodeMirror 6 with @uiw/react-codemirror

**Use CodeMirror 6 (not Monaco, not plain textarea).** Rationale:

| Criterion | CodeMirror 6 | Monaco | Plain Textarea |
|-----------|-------------|--------|----------------|
| Bundle size | ~50KB (tree-shakeable) | ~4MB | negligible |
| Mobile support | Excellent (contenteditable model) | Poor | Native |
| React integration | @uiw/react-codemirror (maintained) | Custom wrapper needed | Native |
| Markdown syntax highlighting | @codemirror/lang-markdown (official) | Built-in but heavy | None |
| Vite compatibility | No issues | Known chunking issues | N/A |
| Non-technical UX | Good (familiar text editor feel) | VS Code feel (intimidating) | Plain textarea |

Monaco is the right choice for developer tools. For entrepreneurs editing their agent's SOUL.md, it is the wrong choice — it signals "this is for programmers." CodeMirror with markdown mode looks like a document editor, which is the correct mental model.

### Recommended Implementation Pattern

```
@uiw/react-codemirror        — CodeMirror 6 React component
@codemirror/lang-markdown    — Markdown syntax highlighting
@codemirror/theme-one-dark   — or a light theme variant
react-markdown + remark-gfm  — For the rendered preview pane
```

### Split-View Pattern (Edit + Preview)

For the Agent Settings panel, use a two-tab pattern rather than a true split-view:
- Tab 1: "Edit" — CodeMirror editor with markdown highlighting
- Tab 2: "Preview" — Rendered markdown via ReactMarkdown

Why tabs over split-pane: the Agent Settings panel is in a dashboard sidebar/panel, not a full-width editor. Split-pane requires too much horizontal real estate on typical 1440px screens. Tab switching is familiar and fast. The existing codebase uses ReactMarkdown for chat — reuse it here.

For MEMORY.md (read-only in UI): show only the Preview tab with a subtle "This file is written by your agent" message. No edit tab, no CodeMirror instance.

### Auto-Save Pattern

Debounce saves: write to Supabase on 2-second idle after last keypress. Show a "Saving..." → "Saved" indicator in the tab header. Never require a Save button — entrepreneurs don't think in "commit changes" terms. The file metaphor implies it saves itself (like Google Docs).

### File Tab Bar Pattern

For the 6-file workspace (IDENTITY, SOUL, SOPs, MEMORY, HEARTBEAT, TOOLS), use a horizontal tab bar above the editor:

```
[ IDENTITY ] [ SOUL ] [ SOPs ] [ MEMORY* ] [ HEARTBEAT ] [ TOOLS ]
```

Mark MEMORY with a lock icon or asterisk. This is discoverable, keeps all files accessible without navigation, and matches how developers and non-developers alike expect file tabs to work.

---

## Table Stakes (Must Have — Missing = Product Feels Incomplete)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Agent recommendation with per-agent reasoning | Users expect AI to explain itself; blank lists feel arbitrary | Medium | Tie each recommendation to specific onboarding answers |
| Pre-checked team acceptance with single CTA | Users expect low-friction activation; forms feel like software | Low | "Activate My Team" CTA; opt-out, not opt-in |
| Streaming status labels during agent work | Static spinners feel broken; users expect visible thinking | Low | Update status string every 1–3s during processing |
| Last active timestamp per agent | Team view without activity timestamps feels like a dead directory | Low | Pull from heartbeat_log or task completion table |
| Morning briefing digest (Chief of Staff) | If heartbeats run but nothing surfaces, users think it's broken | Medium | Chief of Staff synthesizes all agent findings into one daily message |
| Per-agent notification controls | Without this, users disable all notifications and churn | Medium | Channel, frequency, active hours, enable/disable |
| CodeMirror markdown editor with auto-save | Plain textarea for config files signals amateurism | Medium | @uiw/react-codemirror + debounced Supabase write |
| MEMORY.md "learned X things" counter | Without visible learning signal, agents feel static | Low | COUNT of memory entries shown in agent card |
| Intent preview before high-risk actions | Users who are surprised by agent actions lose trust permanently | Medium | Show plan before execute for any risk_level=high task |

---

## Differentiators (Not Expected — But Create the "Wow" Moment)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Agent activation animation / "team briefing" screen | Transforms onboarding completion into an emotional moment — signals the agents now know the business | Low | 2–3s animated reveal, agent avatars appear one by one |
| Heartbeat in agent's own voice | Notifications from "your Marketing Manager" rather than from "Worryless AI" creates a fundamentally different relationship | Low | Prepend agent persona to heartbeat outputs |
| MEMORY.md progression narrative | "Your Sales Rep has learned 12 things about your business" makes the agent feel alive and growing | Low | Aggregate MEMORY.md entry count per agent, surface in agent card |
| Severity-tiered notifications (Urgent / Heads-up / Digest) | Most platforms surface everything — Worryless AI surfaces only what matters | Medium | Heartbeat output must classify its own finding severity |
| Collapsible "How I got here" reasoning trail | Transparent reasoning without overwhelming non-technical users | Medium | Collapsible section in agent chat/heartbeat output |
| Agent autonomy dial per agent (Suggest / Confirm / Autopilot) | Users in control of each agent's independence level; builds trust faster than a global setting | Medium | Stored in agent workspace config or user_agents table |

---

## Anti-Features (Do NOT Build These)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Blank "create your agent" form | Cognitive overload for non-technical users; breaks "meet your team" metaphor | Pre-configured catalog with activation only |
| Per-run notifications for routine tasks | Notification fatigue in days; users disable, product loses its voice | Digest mode; notify only on genuine findings |
| Full-width Monaco editor for workspace files | Wrong mental model (developer IDE) for entrepreneurs editing personality files | CodeMirror with markdown mode |
| Agent capability page with technical specs | Non-technical users don't care about API integrations; they care about what the agent does for their business | Role-framed capability descriptions ("handles your inbox") |
| Freeform agent creation in v1 | Unlimited customization creates analysis paralysis; increases support burden; ships slower | Fixed 12-type catalog; custom is v2 |
| Push notification for every heartbeat | Even with smart suppression, users do not want every check-in surfaced | HEARTBEAT_OK suppression (already in spec); push only for Urgent findings |
| Lateral agent spawning (agent creates agents) | Confuses users about who is responsible for what; violates the org hierarchy mental model | Chief of Staff orchestrates depth-1 agents only (already in spec) |

---

## Feature Dependencies

```
Agent Spawner (recommendation engine)
  → Agent Team Selector UI (accept/decline at end of onboarding)
    → Agent MD Workspace (auto-generated from business context at spawn time)
      → Agent Settings Panel (CodeMirror editor for IDENTITY, SOUL, SOPs, HEARTBEAT)
      → MEMORY.md counter (read-only display of agent learning)

Heartbeat System (per-agent proactive tick)
  → Severity classification in heartbeat output (Urgent / Heads-up / Digest)
    → Notification delivery (push/email for Urgent only)
    → Morning briefing digest (Chief of Staff synthesizes all agent findings)

Org Structure / Team View
  → Last active timestamp (from heartbeat_log or task completion)
  → Pulsing active indicator (agent ran in last 4 hours)
  → Agent autonomy dial per agent

Role-Based Tooling
  → TOOLS.md per agent (documents available integrations)
  → Skill boundary enforcement (agent only calls tools in its role)
```

---

## MVP Prioritization

**Build these for the milestone (table stakes + highest-leverage differentiators):**

1. **Agent Spawner + Team Selector UI** — with per-agent reasoning cards tied to onboarding answers
2. **Team activation animation** — the "briefing your team" moment; tiny effort, enormous emotional payoff
3. **MD Workspace with CodeMirror editor** — IDENTITY, SOUL, SOPs, HEARTBEAT editable; MEMORY read-only with count display
4. **Heartbeat severity classification** — Urgent / Heads-up / Digest; push only Urgent
5. **Last active + pulsing indicator** in Team/Org view
6. **Morning briefing digest** — Chief of Staff synthesizes all agent heartbeat findings into one morning message
7. **Streaming status labels** — replace spinners with specific "Reviewing invoices..." text during agent processing

**Defer from this milestone:**

- **Autonomy dial per agent** — worth building but validator system already handles tiers 1+2; tier 3 (Autopilot) is a separate trust milestone
- **Collapsible reasoning trail** — high value but adds complexity to every agent response; v-next feature
- **Per-agent notification preferences** — build the notification system first; preferences are a refinement once users have been through the experience once

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Platform competitor features (Q1) | HIGH | Lindy official blog, AutoGen official docs, AgentOps official docs |
| Agent onboarding UX patterns (Q2) | HIGH | Smashing Magazine Feb 2026 article (primary source), UXMag agentic UX patterns |
| Notification fatigue patterns (Q3) | MEDIUM-HIGH | MagicBell research, Carbon Design System, Slack AI diary, multiple consistent sources |
| "Feels alive" UI patterns (Q4) | MEDIUM | Fuselab, UXMag, AutoGen Studio docs — consistent pattern across multiple sources |
| CodeMirror vs Monaco recommendation (Q5) | HIGH | Official CodeMirror docs, @uiw/react-codemirror README, multiple comparison sources |
| "Reasoning card" onboarding pattern (specific) | MEDIUM | Inferred from agentic UX trust literature; no direct competitor example found for "why this agent" card pattern specifically — this may be a novel pattern for Worryless AI |

---

## Gaps to Address in Phase Research

- **Notification delivery mechanics**: How to route push/email from Supabase Edge Functions without adding a new service (Resend? Supabase SMTP? In-app only for v1?). This needs a spike before heartbeat delivery is built.
- **Morning briefing timing**: What time to run the Chief of Staff digest aggregation — needs per-user timezone awareness. Supabase pg_cron runs in UTC; requires user timezone stored in profiles.
- **Autonomy dial storage**: Where the per-agent autonomy setting lives — likely `user_agents` table or `agent_workspaces` — needs schema decision before building.
- **CodeMirror bundle impact**: The existing Vite SPA does not use a code editor. Need to verify @uiw/react-codemirror doesn't push the bundle past acceptable size. Lazy-load the Agent Settings panel to mitigate.

---

## Sources

- [Lindy 3.0 Launch — "Meet Your First AI Employee"](https://www.lindy.ai/blog/lindy-3-0)
- [Lindy Enterprise Announcement — Team Accounts and Org Management](https://www.lindy.ai/blog/lindy-enterprise-announcement)
- [AutoGen Studio v0.4 User Guide — Microsoft](https://microsoft.github.io/autogen/dev//user-guide/autogenstudio-user-guide/index.html)
- [AgentOps Integration with AutoGen — Microsoft](https://microsoft.github.io/autogen/0.2/blog/2024/07/25/AgentOps/)
- [Designing Agentic AI: Practical UX Patterns — Smashing Magazine, February 2026](https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/)
- [Secrets of Agentic UX: Emerging Design Patterns — UX Magazine](https://uxmag.com/articles/secrets-of-agentic-ux-emerging-design-patterns-for-human-interaction-with-ai-agents)
- [UI Design Trends for AI Agents — Fuselab Creative](https://fuselabcreative.com/ui-design-for-ai-agents/)
- [Help Your Users Avoid Notification Fatigue — MagicBell](https://www.magicbell.com/blog/help-your-users-avoid-notification-fatigue)
- [Slack AI Digest Feature Announcement](https://slack.com/blog/news/slack-ai-has-arrived)
- [Notification Pattern — Carbon Design System (IBM)](https://carbondesignsystem.com/patterns/notification-pattern/)
- [Relevance AI Reviews — G2](https://www.g2.com/products/relevance-ai/reviews)
- [react-codemirror — @uiw GitHub](https://github.com/uiwjs/react-codemirror)
- [CodeMirror Official — codemirror.net](https://codemirror.net/)
- [uiw/react-markdown-editor — GitHub](https://github.com/uiwjs/react-markdown-editor)
- [AI Agent Onboarding: UX Strategies — Standard Beagle Studio](https://standardbeagle.com/ai-agent-onboarding/)
- [37 AI Patterns for Product Teams — AI-UX Collective, Medium](https://medium.com/ai-ux-designers/37-ai-patterns-for-product-teams-e04c953270b3)
