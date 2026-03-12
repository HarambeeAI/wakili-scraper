# Codebase Structure

**Analysis Date:** 2026-03-12

## Directory Layout

```
Worryless AI 33/
├── .planning/
│   └── codebase/               # GSD analysis documents
└── worrylesssuperagent/        # Main application (git root)
    ├── index.html              # SPA entry HTML
    ├── package.json            # Node dependencies and scripts
    ├── vite.config.ts          # Vite build configuration
    ├── tsconfig.json           # TypeScript project config
    ├── tailwind.config.ts      # Tailwind CSS theme/config
    ├── components.json         # shadcn/ui component config
    ├── eslint.config.js        # ESLint configuration
    ├── postcss.config.js       # PostCSS configuration
    ├── bun.lockb               # Bun lockfile
    ├── public/                 # Static assets served at root
    │   ├── favicon.ico
    │   ├── favicon.png
    │   ├── placeholder.svg
    │   └── robots.txt
    ├── src/                    # Frontend React application
    │   ├── assets/             # Static image/icon assets imported by components
    │   │   ├── agents/         # Agent avatar images
    │   │   └── landing/        # Landing page images
    │   ├── components/         # React components
    │   │   ├── ui/             # shadcn/ui primitives (51 files)
    │   │   ├── landing/        # Marketing/landing page sections
    │   │   ├── dashboard/      # Dashboard shell and overview
    │   │   ├── agents/         # Per-agent feature panels
    │   │   ├── chat/           # AI Chief of Staff chat interface
    │   │   ├── onboarding/     # Multi-step onboarding wizard
    │   │   └── settings/       # User and agent settings
    │   ├── hooks/              # Custom React hooks
    │   ├── integrations/
    │   │   └── supabase/       # Supabase client + auto-generated types
    │   ├── lib/                # Shared utilities
    │   └── pages/              # Route-level page components
    └── supabase/               # Supabase backend
        ├── functions/          # Edge Functions (Deno TypeScript)
        │   ├── chat-with-agent/
        │   ├── crawl-business-website/
        │   ├── generate-content/
        │   ├── generate-image/
        │   ├── generate-invoice-image/
        │   ├── generate-leads/
        │   ├── generate-outreach/
        │   ├── orchestrator/
        │   ├── parse-datasheet/
        │   ├── planning-agent/
        │   ├── run-scheduled-tasks/
        │   ├── send-daily-briefing/
        │   ├── send-test-email/
        │   ├── send-validation-email/
        │   └── sync-gmail-calendar/
        └── migrations/         # Ordered SQL migration files
```

## Directory Purposes

**`src/pages/`:**
- Purpose: Route-level page components, one file per route
- Contains: `Index.tsx` (landing), `Auth.tsx` (sign in/up), `Dashboard.tsx` (authenticated app shell), `NotFound.tsx`
- Key files: `Dashboard.tsx` owns the `ActiveView` type and all view-switching logic

**`src/components/ui/`:**
- Purpose: Low-level shadcn/ui primitives — buttons, inputs, dialogs, cards, sidebar, etc.
- Contains: ~51 component files generated/managed via `components.json`
- Do NOT add feature logic here; these are purely presentational building blocks

**`src/components/landing/`:**
- Purpose: Marketing page section components
- Key files: `LandingNav.tsx`, `HeroSection.tsx`, `PricingSection.tsx`, `FAQSection.tsx`, `Footer.tsx`, `HeroBackground.tsx`, `WhySection.tsx`, `SpecialistsSection.tsx`, `UseCasesSection.tsx`, `HowItWorksSection.tsx`, `CTASection.tsx`

**`src/components/dashboard/`:**
- Purpose: Dashboard shell, navigation sidebar, overview metrics, task management, automation controls
- Key files: `DashboardSidebar.tsx`, `DashboardHeader.tsx`, `DashboardOverview.tsx`, `TaskList.tsx`, `CreateTaskDialog.tsx`, `AutomationPanel.tsx`, `BusinessArtifacts.tsx`

**`src/components/agents/`:**
- Purpose: Per-agent feature panels with CRUD UI and data display
- Key files: `AccountantAgent.tsx`, `MarketerAgent.tsx`, `SalesRepAgent.tsx`, `PersonalAssistantAgent.tsx`
- Each agent component fetches its own domain data from Supabase and invokes edge functions for AI tasks

**`src/components/chat/`:**
- Purpose: AI Chief of Staff chat interface (multi-agent orchestrated chat)
- Key files: `ChatInterface.tsx` — handles message history, file uploads to `chat-attachments` storage, and calls the `orchestrator` edge function

**`src/components/onboarding/`:**
- Purpose: Multi-step conversational onboarding wizard shown to new users
- Key files: `ConversationalOnboarding.tsx` (primary wizard), `BusinessOnboarding.tsx`

**`src/components/settings/`:**
- Purpose: User profile settings, timezone, agent validator management
- Key files: `SettingsPage.tsx`

**`src/hooks/`:**
- Purpose: Custom React hooks shared across components
- Key files: `use-toast.ts` (toast notification system), `use-mobile.tsx` (mobile breakpoint detection), `useScrollAnimation.tsx` (scroll-triggered animations)

**`src/integrations/supabase/`:**
- Purpose: Single access point for all Supabase interaction
- Key files: `client.ts` (typed Supabase client singleton), `types.ts` (auto-generated DB schema types — do not edit manually)
- Import pattern: `import { supabase } from "@/integrations/supabase/client"`

**`src/lib/`:**
- Purpose: Shared pure utility functions
- Key files: `utils.ts` — exports `cn()` (clsx + tailwind-merge helper for className composition)

**`src/assets/`:**
- Purpose: Static images and icons imported directly by React components
- Subdirectories: `agents/` (agent avatars), `landing/` (landing page imagery)

**`supabase/functions/`:**
- Purpose: Deno TypeScript edge functions deployed to Supabase
- Pattern: Each function is a directory containing a single `index.ts` that calls `serve(async (req) => { ... })`
- Functions communicate with Supabase using the service-role key (`SUPABASE_SERVICE_ROLE_KEY`) for privileged operations

**`supabase/migrations/`:**
- Purpose: Ordered SQL migration files that define and evolve the database schema
- Naming: `{timestamp}_{uuid}.sql`
- Contains: Table definitions, enum types, RLS policies, triggers, and functions

## Key File Locations

**Entry Points:**
- `worrylesssuperagent/index.html`: SPA HTML shell loaded by browser
- `worrylesssuperagent/src/pages/Index.tsx`: Landing page (`/`)
- `worrylesssuperagent/src/pages/Auth.tsx`: Authentication page (`/auth`)
- `worrylesssuperagent/src/pages/Dashboard.tsx`: Full authenticated application shell (`/dashboard`)

**Configuration:**
- `worrylesssuperagent/vite.config.ts`: Vite build config (path aliases, plugins)
- `worrylesssuperagent/tailwind.config.ts`: Design tokens and theme
- `worrylesssuperagent/components.json`: shadcn/ui install config
- `worrylesssuperagent/tsconfig.app.json`: TypeScript paths including `@/` alias → `src/`
- `worrylesssuperagent/.env`: Supabase URL and publishable key (not committed)

**Core Logic:**
- `worrylesssuperagent/src/integrations/supabase/client.ts`: Supabase client (all DB/auth/storage/function calls go through this)
- `worrylesssuperagent/src/integrations/supabase/types.ts`: Complete auto-generated DB type definitions
- `worrylesssuperagent/supabase/functions/orchestrator/index.ts`: Primary AI routing and multi-agent orchestration
- `worrylesssuperagent/supabase/functions/run-scheduled-tasks/index.ts`: Automation task scheduler
- `worrylesssuperagent/supabase/functions/planning-agent/index.ts`: Onboarding initializer and automation setup
- `worrylesssuperagent/src/lib/utils.ts`: `cn()` utility

**Database Schema:**
- `worrylesssuperagent/supabase/migrations/20251204060048_4cba7ad2-...sql`: Initial schema (profiles, agent_tasks, invoices, transactions, social_posts, leads, outreach_emails, integrations, RLS policies)

## Naming Conventions

**Files:**
- React components: PascalCase — `AccountantAgent.tsx`, `DashboardSidebar.tsx`
- Hooks: camelCase prefixed with `use` — `use-toast.ts`, `useScrollAnimation.tsx`
- Utilities: camelCase — `utils.ts`
- Edge functions: kebab-case directory names — `chat-with-agent/`, `run-scheduled-tasks/`
- Migration files: `{timestamp}_{uuid}.sql`

**Directories:**
- Feature grouping in `src/components/` uses lowercase kebab-case — `agents/`, `chat/`, `dashboard/`, `landing/`, `onboarding/`, `settings/`
- UI primitives isolated in `src/components/ui/`

**Components:**
- Named exports for feature components: `export function AccountantAgent() {}`
- Default exports for page components: `export default Dashboard`

**Types:**
- Local types defined inline at top of each file (e.g., `type Invoice = { ... }`)
- DB types imported from `@/integrations/supabase/types`
- Union string types for view routing: `export type ActiveView = "overview" | "accountant" | ...` in `src/pages/Dashboard.tsx`

## Where to Add New Code

**New Agent Feature Panel:**
- Implementation: `src/components/agents/{AgentName}Agent.tsx`
- Register view: Add case to `ActiveView` union in `src/pages/Dashboard.tsx` and `renderContent()` switch
- Add sidebar item: Add entry to `agentItems` array in `src/components/dashboard/DashboardSidebar.tsx`

**New Edge Function:**
- Create directory: `supabase/functions/{function-name}/`
- Create: `supabase/functions/{function-name}/index.ts`
- Pattern: Copy CORS headers object and `serve` wrapper from an existing function like `chat-with-agent/index.ts`
- Invoke from frontend: `supabase.functions.invoke('{function-name}', { body: { ... } })`

**New Database Table:**
- Create a new migration file in `supabase/migrations/` with timestamp prefix
- Always include: `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`, RLS `ENABLE ROW LEVEL SECURITY`, and per-operation RLS policies
- Regenerate types: update `src/integrations/supabase/types.ts` after migration

**New Landing Section:**
- Implementation: `src/components/landing/{SectionName}Section.tsx`
- Register: Import and add to `src/pages/Index.tsx`

**New Settings Section:**
- Extend `src/components/settings/SettingsPage.tsx`

**Shared Utilities:**
- Small pure helpers: `src/lib/utils.ts`
- React hooks: `src/hooks/{hook-name}.ts` or `src/hooks/{hook-name}.tsx`

**Static Assets:**
- Images imported by React components: `src/assets/`
- Files served at URL root: `public/`

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD analysis documents for AI-assisted development
- Generated: By GSD mapping commands
- Committed: Yes (planning artifacts)

**`supabase/migrations/`:**
- Purpose: Canonical database schema history
- Generated: Partially (Supabase CLI can generate, or written by hand)
- Committed: Yes — required for schema reproducibility

**`src/components/ui/`:**
- Purpose: shadcn/ui component library, managed via `components.json`
- Generated: Via `npx shadcn-ui add <component>` CLI
- Committed: Yes — these files are owned by the project and may be customized

**`src/integrations/supabase/types.ts`:**
- Purpose: Auto-generated TypeScript types reflecting live Supabase schema
- Generated: Yes — by Supabase CLI (`supabase gen types typescript`)
- Committed: Yes — do not edit manually

---

*Structure analysis: 2026-03-12*
