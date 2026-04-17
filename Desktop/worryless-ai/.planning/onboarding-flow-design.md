# Worryless AI — Onboarding Flow & Brand DNA Agent

## Overview

Build the post-signup onboarding flow for Worryless AI, a multi-tenant SaaS platform. After signing up, users complete a 4-step wizard, then a LangGraph-powered AI agent crawls their website and produces 4 brand DNA files + extracts their logo. Results stream in real-time into a chat interface.

This requires migrating from the current Vite SPA to Next.js App Router and adding a full backend stack.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js App Router |
| Auth | BetterAuth + organization plugin |
| Database | PostgreSQL + Drizzle ORM (Railway) |
| Agent | LangGraph (LangChain JS) |
| LLM | Gemini 3 Pro via OpenRouter (multimodal) |
| Web Crawl | Firecrawl |
| Web Search | Serper |
| Streaming | Server-Sent Events (SSE) |
| Styling | Tailwind CSS (Inter Tight font, #1483f3 primary) |
| Deployment | Railway |

## Onboarding Wizard

4-step flow after signup, implemented as a stepper component at `/onboarding`.

### Step 1 — Website URL

- Centered card with URL input field
- Headline: "What's your website?"
- Subtext: "We'll analyze your brand, market, and competition"
- Validation: valid URL format, ping to confirm reachable
- CTA: "Continue"

### Step 2 — Services Selection

- Headline: "What do you need help with?"
- Subtext: "Select all that apply. This helps Helena focus on what matters most."
- 5 pill/card options, ALL pre-selected by default:
  - Social Media (icon)
  - SEO (icon)
  - Content Writing (icon)
  - Email Marketing (icon)
  - Paid Ads (icon)
- User can deselect any they don't need
- CTA: "Continue"

### Step 3 — Connect Platforms

- Headline: "Connect your platforms"
- Cards for Google Analytics, social accounts, etc.
- Each shows "Connect now" button
- Skip button prominently available — this step is optional
- OAuth flows are future phase — for now show UI with skip option

### Step 4 — Redirect

- Save onboarding data to database (website URL, selected services, connected platforms)
- Set `organization.onboarding_completed = true`
- Redirect to `/app/[orgSlug]/chat` where the agent auto-starts

### Design Language

Same as landing page: Inter Tight font, #1483f3 primary blue, clean white backgrounds (#fafafa), subtle card shadows, rounded corners. Mobile-responsive.

## LangGraph Agent Architecture

### Graph Structure

```
START → plan_tasks → crawl_website → ┬─ extract_brand_guidelines    (parallel)
                                      ├─ generate_business_profile   (parallel)
                                      └─ research_market → generate_marketing_strategy (sequential)
                                   → synthesize → END
```

### Agent State Schema

```typescript
interface AgentState {
  // Inputs
  websiteUrl: string;
  selectedServices: string[];
  organizationId: string;

  // Crawled data
  crawledContent: string;
  screenshots: string[];
  logoUrl: string | null;
  computedStyles: object;

  // Search data
  searchResults: object[];

  // Outputs
  files: BrandFile[];
  messages: ChatMessage[];
  status: string;

  // Control
  currentTask: string;
  errors: string[];
}
```

### Node Breakdown

#### 1. `plan_tasks`

Receives onboarding input. Posts first chat message: "Let me dive right in — starting with your website and brand to get a clear picture of what [Company] is all about."

#### 2. `crawl_website`

- Firecrawl scrapes the full site (content + screenshots)
- Parses HTML for logo (checks link rel icon, nav img tags with logo in class/alt/src, Open Graph images, favicon)
- Downloads highest quality logo (prefer SVG > PNG > JPG)
- Extracts computed CSS styles (colors, fonts, border-radius, shadows)
- Posts status: "Working on getWebsiteContent"
- Must complete before parallel branch

#### 3. `extract_brand_guidelines` (parallel)

- Sends screenshots + HTML/CSS to Gemini 3 Pro with vision
- Extracts: brand personality, color palette table, typography table, UI component styles, content guidelines
- Posts narration + collapsible file card

#### 4. `generate_business_profile` (parallel)

- Uses crawled content + light Serper search (press mentions, traction)
- Produces: overview, traction metrics, core features, pricing table, value props by segment, marketing goals, CTAs
- Posts narration + file card

#### 5. `research_market` (parallel, then feeds into strategy)

- Heavy Serper usage: market sizing queries, competitor searches, keyword research
- Produces: market size with figures, target segments ranked, competitive landscape, company moat, keyword table, audience pain points, effective channels
- Posts narration + file card

#### 6. `generate_marketing_strategy` (after market research)

- Receives all prior context: crawled content, business profile, brand guidelines, market research
- Produces: north star goal, positioning, channel strategies (SEO, email, paid ads, social, CRO), funnel overview table, 30-day quick wins
- Posts narration + file card

#### 7. `synthesize`

- Posts wrap-up message summarizing what was found
- Saves all 4 files + logo to database under the organization
- Marks agent run as completed

### Tools

- `firecrawl_scrape` — Crawl a URL, return content + screenshots
- `serper_search` — Web search via Serper API
- `serper_keyword` — Keyword research data via Serper

### Logo Extraction

During `crawl_website`, parse HTML for logo:
1. `<link rel="icon">` or `<link rel="apple-touch-icon">`
2. `<img>` in header/nav with "logo" in class/alt/src
3. Open Graph `<meta property="og:image">`
4. Favicon as fallback

Download highest quality version. Store URL in organization record.

### Prompt Engineering Strategy

Each prompt enforces:
- Specific numbers — market data cited, exact pricing extracted, real metrics
- Structured tables — keywords, pricing, competitors, colors all in markdown tables
- Prioritized lists — segments ranked by opportunity, not just listed
- Evidence-grounded claims — every insight ties back to site content or search data
- Opinionated recommendations — actionable, not vague

Quality controls:
- Prompts include structural few-shot examples (format, not content)
- marketing_strategy node receives the other 3 files as context
- Temperature: 0.3-0.4 for factual extraction, 0.6 for strategy
- Each prompt enforces exact markdown structure

## Chat UI

### Layout — Three-Panel Design

#### Left Sidebar (narrow)

- Organization name + extracted logo at top
- Navigation: "Brand Knowledge Base" link
- Chat history list
- User profile at bottom

#### Center — Chat Area

- Agent avatar + name at top
- Messages stream in real-time:
  - Agent text messages — conversational narration with agent avatar
  - Status indicators — "Working on getWebsiteContent" with animated dots
  - File cards — collapsible markdown cards with file icon, filename, "Saved" green badge, rendered markdown, collapse/expand toggle, copy button
- Message input at bottom (disabled during analysis, enabled after)

#### Right Sidebar

- Brand Knowledge Base — lists 4 saved files with dates
- Brand Assets — extracted logo with "Click to replace"
- Metrics — placeholder "Connect GA" (future)
- Channels — placeholder "Connect now" (future)
- Upcoming Tasks — placeholder (future)

### File Card Interaction

- View only: collapse, expand, copy
- "Saved" badge indicates stored in knowledge base
- No editing or regeneration (future)

## Data Model

### Tables

organizations:
- id (uuid PK)
- name (text)
- slug (text unique)
- website_url (text)
- logo_url (text)
- selected_services (jsonb)
- onboarding_completed (boolean default false)
- created_at, updated_at (timestamptz)

brand_files:
- id (uuid PK)
- organization_id (uuid FK -> organizations)
- type (text: business_profile | brand_guidelines | market_research | marketing_strategy)
- title (text)
- content (text — raw markdown)
- metadata (jsonb — structured extracted data)
- created_at, updated_at (timestamptz)

chat_messages:
- id (uuid PK)
- organization_id (uuid FK -> organizations)
- role (text: agent | user | system)
- content (text)
- type (text: text | file_card | status)
- file_id (uuid FK -> brand_files, nullable)
- created_at (timestamptz)

agent_runs:
- id (uuid PK)
- organization_id (uuid FK -> organizations)
- status (text: pending | running | completed | failed)
- tasks (jsonb — task plan with individual statuses)
- started_at, completed_at (timestamptz)

## API Routes

```
(marketing)/page.tsx                    — Landing page (public)
(auth)/login/page.tsx                   — Login
(auth)/signup/page.tsx                  — Signup
(auth)/onboarding/page.tsx              — 4-step wizard
(app)/[orgSlug]/chat/page.tsx           — Main chat interface
api/auth/[...all]/route.ts              — BetterAuth handler
api/agent/start/route.ts               — POST: trigger agent run
api/agent/stream/[runId]/route.ts       — GET: SSE stream
api/brand-files/[orgId]/route.ts        — GET: retrieve saved files
```

### SSE Event Format

```
event: status
data: {"task":"crawl_website","message":"Working on getWebsiteContent"}

event: message
data: {"role":"agent","content":"Let me dive right in..."}

event: file_card
data: {"fileId":"...","type":"business_profile","title":"Business Profile","content":"# ..."}

event: complete
data: {"status":"completed","filesGenerated":4}
```

### Middleware

- Auth on (app) routes — redirect to login if unauthenticated
- Onboarding check — redirect to /onboarding if not completed
- Org access — verify user belongs to org in URL slug

## Project Structure

```
worryless-ai/
├── src/
│   ├── app/
│   │   ├── (marketing)/page.tsx, layout.tsx
│   │   ├── (auth)/login, signup, onboarding
│   │   ├── (app)/layout.tsx, [orgSlug]/chat/page.tsx
│   │   ├── api/auth, agent, brand-files
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── marketing/ (ported landing page components)
│   │   ├── onboarding/ (OnboardingStepper, WebsiteStep, ServicesStep, PlatformsStep)
│   │   ├── chat/ (ChatLayout, ChatSidebar, ChatMessages, ChatMessage, FileCard, StatusIndicator, KnowledgePanel, ChatInput)
│   │   └── ui/ (Button, Input, Card, Stepper)
│   ├── lib/
│   │   ├── auth.ts, auth-client.ts
│   │   ├── db/ (index.ts, schema.ts, migrate.ts)
│   │   └── agent/ (graph.ts, state.ts, nodes/, tools/, prompts/)
│   ├── hooks/ (useSSE.ts, useOnboarding.ts)
│   └── types/index.ts
├── drizzle/migrations/
├── .env.local
├── drizzle.config.ts, next.config.ts, tailwind.config.ts
├── package.json, tsconfig.json
```

## Environment Variables

```
BETTER_AUTH_SECRET=<generated>
BETTER_AUTH_URL=http://localhost:3000
DATABASE_URL=postgresql://...@railway/worryless
OPENROUTER_API_KEY=<provided>
FIRECRAWL_API_KEY=<provided>
SERPER_API_KEY=<provided>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Out of Scope (Future Phases)

- Platform OAuth connections (GA, social media)
- Channels (#main, #performance, #calendar)
- Metrics dashboard (active users, sessions)
- Upcoming tasks
- Inline file editing or regeneration
- Multi-agent workflows
- Follow-up conversation with the agent
- Brand asset management beyond logo
