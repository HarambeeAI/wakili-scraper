# Codebase Structure

**Analysis Date:** 2026-03-18

## Directory Layout

```
worrylesssuperagent/
├── src/                                    # Frontend React source
│   ├── main.tsx                            # React app entry point
│   ├── App.tsx                             # Root component, routes, providers
│   ├── index.css                           # Global styles + Tailwind imports
│   ├── App.css                             # App-level CSS
│   ├── vite-env.d.ts                       # Vite env type definitions
│   ├── __tests__/                          # Test files (vitest, co-located by domain)
│   │   ├── sanitize.test.ts                # Prompt injection filter tests
│   │   ├── heartbeatParser.test.ts         # Heartbeat log parsing tests
│   │   ├── useTeamData.test.ts             # Team data hook tests
│   │   ├── useAgentMarketplace.test.ts     # Not found - TODO
│   │   └── [other hook/lib tests]
│   ├── pages/                              # Route pages (not Next.js, React Router pages)
│   │   ├── Index.tsx                       # Landing page (/)
│   │   ├── Auth.tsx                        # Auth flow (/auth)
│   │   ├── Dashboard.tsx                   # Main app dashboard (/dashboard)
│   │   └── NotFound.tsx                    # 404 page (*)
│   ├── components/                         # Reusable UI components
│   │   ├── ui/                             # Shadcn/Radix-UI base components (51 files)
│   │   │   ├── button.tsx                  # Base button
│   │   │   ├── card.tsx                    # Card container
│   │   │   ├── dialog.tsx                  # Modal/dialog
│   │   │   ├── sidebar.tsx                 # Sidebar layout + context
│   │   │   ├── form.tsx                    # React-hook-form wrapper
│   │   │   ├── [others...]                 # accordion, tabs, input, label, etc.
│   │   ├── agents/                         # Agent-specific components (9 files)
│   │   │   ├── AccountantAgent.tsx         # Accounting agent UI (31 KB)
│   │   │   ├── MarketerAgent.tsx           # Marketing agent UI (12 KB)
│   │   │   ├── SalesRepAgent.tsx           # Sales rep agent UI (14 KB)
│   │   │   ├── PersonalAssistantAgent.tsx  # Personal assistant agent UI (22 KB)
│   │   │   ├── GenericAgentPanel.tsx       # Fallback for custom agents
│   │   │   ├── HeartbeatConfigSection.tsx  # Heartbeat scheduler UI
│   │   │   └── workspace/                  # Agent instruction editor
│   │   │       ├── WorkspaceTabs.tsx       # Tab switcher (Instructions, Memory, Context)
│   │   │       ├── WorkspaceEditor.tsx     # CodeMirror-based editor
│   │   │       ├── WorkspaceEditorLazy.tsx # Lazy-load wrapper
│   │   │       └── MemoryTab.tsx           # Memory/context tab
│   │   ├── dashboard/                      # Dashboard feature components (8 files)
│   │   │   ├── DashboardSidebar.tsx        # Left navigation
│   │   │   ├── DashboardHeader.tsx         # Top bar with user/settings
│   │   │   ├── DashboardOverview.tsx       # Overview/home view
│   │   │   ├── TaskList.tsx                # Task display
│   │   │   ├── CreateTaskDialog.tsx        # Task creation modal
│   │   │   ├── AutomationPanel.tsx         # Automation rules UI
│   │   │   ├── BusinessArtifacts.tsx       # Generated documents viewer
│   │   │   └── NotificationBell.tsx        # Notification popover
│   │   ├── chat/                           # Chat interface
│   │   │   └── ChatInterface.tsx           # Multi-agent chat UI (20 KB)
│   │   ├── team/                           # Team management
│   │   │   └── TeamView.tsx                # Team overview + agent health
│   │   ├── marketplace/                    # Agent marketplace
│   │   │   ├── AgentMarketplace.tsx        # Catalog + activation
│   │   │   └── AgentMarketplaceCard.tsx    # Card per agent type
│   │   ├── onboarding/                     # First-time user flow
│   │   │   ├── ConversationalOnboarding.tsx
│   │   │   └── [onboarding steps]
│   │   ├── settings/                       # User settings
│   │   │   └── SettingsPage.tsx            # Profile, integrations, preferences
│   │   ├── landing/                        # Landing page sections (11 files)
│   │   │   ├── LandingNav.tsx              # Header nav
│   │   │   ├── HeroSection.tsx             # Hero banner
│   │   │   ├── SpecialistsSection.tsx      # Agents showcase
│   │   │   ├── HowItWorksSection.tsx       # Product tour
│   │   │   ├── PricingSection.tsx          # Pricing table
│   │   │   ├── FAQSection.tsx              # FAQ accordion
│   │   │   ├── CTASection.tsx              # Call-to-action
│   │   │   ├── WhySection.tsx              # Value prop
│   │   │   ├── UseCasesSection.tsx         # Use cases
│   │   │   ├── HeroBackground.tsx          # Gradient animation background
│   │   │   └── Footer.tsx                  # Footer
│   │   ├── push/                           # Push notification UI
│   │   │   └── PushOptInBanner.tsx         # Opt-in prompt
│   │   └── NavLink.tsx                     # Custom nav link component
│   ├── hooks/                              # Custom React hooks (9 files)
│   │   ├── useTeamData.ts                  # Fetch + realtime team agents (Realtime subscription)
│   │   ├── useAgentMarketplace.ts          # Fetch catalog + active agents, activate/deactivate
│   │   ├── useAgentWorkspace.ts            # Fetch workspace file, auto-save, sanitize
│   │   ├── useHeartbeatConfig.ts           # Fetch heartbeat schedule, update
│   │   ├── useNotifications.ts             # Fetch notifications, mark read
│   │   ├── usePushSubscription.ts          # Register service worker, manage push subscription
│   │   ├── use-toast.ts                    # Sonner toast control
│   │   ├── use-mobile.tsx                  # Responsive breakpoint detection
│   │   └── useScrollAnimation.tsx          # Intersection observer for scroll animations
│   ├── lib/                                # Utility functions (5 files)
│   │   ├── sanitize.ts                     # Prompt injection filter regex patterns (SYNC with _shared/)
│   │   ├── heartbeatParser.ts              # Parse raw heartbeat_log rows → aggregate stats
│   │   ├── heartbeatStatus.ts              # Map heartbeat severity to display label
│   │   ├── buildWorkspacePrompt.ts         # Construct system prompt from workspace files
│   │   └── utils.ts                        # cn() class merge helper
│   ├── integrations/                       # External service clients
│   │   └── supabase/                       # Supabase integration
│   │       ├── client.ts                   # Supabase client initialization (JWT auth)
│   │       └── types.ts                    # Auto-generated TypeScript types from Supabase schema
│   ├── utils/                              # Misc utilities
│   │   └── heartbeatUtils.ts               # Helper: format heartbeat timestamps
│   └── assets/                             # Static images, icons
│       ├── agents/                         # Agent avatar images
│       └── landing/                        # Landing page images
├── supabase/                               # Supabase backend
│   ├── migrations/                         # Database schema migrations
│   │   ├── 001_initial_schema.sql          # Users, profiles, agents, workspace files
│   │   └── [future migrations...]
│   └── functions/                          # Serverless edge functions (Deno)
│       ├── _shared/                        # Shared utilities (duplicate from src/lib)
│       │   └── sanitize.ts                 # Deno version of sanitizer (SYNC with src/lib/sanitize.ts)
│       ├── orchestrator/                   # Main agent team orchestrator
│       │   └── index.ts
│       ├── chat-with-agent/                # Chat entry point, routes to agents
│       │   └── index.ts
│       ├── heartbeat-dispatcher/           # Triggers heartbeat-runner per agent
│       │   └── index.ts
│       ├── heartbeat-runner/               # Executes single agent heartbeat
│       │   └── index.ts
│       ├── spawn-agent-team/               # Creates agent instances
│       │   └── index.ts
│       ├── generate-content/               # Content generation (email, social, etc.)
│       │   └── index.ts
│       ├── generate-image/                 # Image generation via external API
│       │   └── index.ts
│       ├── generate-leads/                 # Lead generation agent
│       │   └── index.ts
│       ├── generate-outreach/              # Outreach email generation
│       │   └── index.ts
│       ├── generate-invoice-image/         # Invoice rendering
│       │   └── index.ts
│       ├── parse-datasheet/                # CSV/datasheet parsing
│       │   └── index.ts
│       ├── crawl-business-website/         # Web scraping/crawling
│       │   └── index.ts
│       ├── planning-agent/                 # Strategic planning
│       │   └── index.ts
│       ├── run-scheduled-tasks/            # CRON trigger for daily jobs
│       │   └── index.ts
│       ├── sync-gmail-calendar/            # Google Calendar sync
│       │   └── index.ts
│       ├── send-validation-email/          # Auth email
│       │   └── index.ts
│       ├── send-test-email/                # Test email delivery
│       │   └── index.ts
│       ├── send-daily-briefing/            # Daily digest email
│       │   └── index.ts
│       ├── send-morning-digest/            # Morning summary
│       │   └── index.ts
│       └── [other functions...]
├── public/                                 # Static assets served as-is
│   ├── index.html                          # SPA HTML shell
│   ├── manifest.json                       # PWA manifest
│   └── [icons, logos, etc.]
├── dist/                                   # Built output (generated by vite build)
├── .git/                                   # Git repository
├── package.json                            # Dependencies, scripts
├── package-lock.json                       # Dependency lock file
├── tsconfig.json                           # TypeScript root config
├── tsconfig.app.json                       # App-specific TypeScript config
├── tsconfig.node.json                      # Build tool TypeScript config
├── vite.config.ts                          # Vite bundler config
├── vitest.config.ts                        # Vitest test runner config
├── tailwind.config.ts                      # Tailwind CSS config
├── postcss.config.js                       # PostCSS config
├── eslint.config.js                        # ESLint rules
├── components.json                         # Shadcn component metadata
└── README.md                               # Project documentation
```

## Directory Purposes

**src/pages/:**
- Purpose: React Router page components (not Next.js pages)
- Contains: Route-level components that map to URL paths
- Key files: `Index.tsx` (landing), `Auth.tsx` (auth UI), `Dashboard.tsx` (main app shell)

**src/components/ui/:**
- Purpose: Reusable unstyled base components from shadcn/radix-ui
- Contains: 51 base components (button, card, dialog, sidebar, form, etc.)
- Generated from: shadcn CLI scaffolding
- Modified: Tailwind class overrides for custom branding

**src/components/agents/:**
- Purpose: Agent-specific views with workspace editor + execution interface
- Contains: 4 specialized agents (Accountant, Marketer, SalesRep, PersonalAssistant) + GenericAgentPanel
- Key pattern: Each renders WorkspaceTabs (Instructions/Memory/Context editor) + agent-specific results UI

**src/components/dashboard/:**
- Purpose: Dashboard layout and feature views
- Contains: Sidebar, header, overview grid, task list, automation rules, business artifacts viewer, notification bell
- Key pattern: Sidebar navigation state drives which component renders in main area

**src/hooks/:**
- Purpose: Encapsulate data fetching, subscriptions, form state, local mutations
- Contains: Custom hooks that return {data, loading, error, handlers...}
- Key pattern: Hooks initialize Supabase subscriptions and return cleanup functions

**src/lib/:**
- Purpose: Pure utility functions with no React dependencies
- Contains: Sanitization, parsing, status computation, CSS class helpers
- Key pattern: Single-export files; no side effects; testable

**src/integrations/supabase/:**
- Purpose: Supabase client and types
- Contains: Client initialization (JWT auto-refresh), auto-generated TypeScript types
- Key pattern: types.ts regenerated after schema changes via `supabase gen types`

**supabase/functions/:**
- Purpose: Serverless backend logic (Deno runtime)
- Contains: 22+ function handlers for chat, agent orchestration, content generation, scheduled tasks, webhooks
- Key pattern: Each function has own /index.ts; _shared/ contains duplicated utilities (due to Deno/Node runtime separation)

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React app bootstrap (React.createRoot + render)
- `src/App.tsx`: Route definitions, global providers (QueryClient, Tooltip, Toaster, Router)
- `public/index.html`: SPA HTML shell with #root div

**Configuration:**
- `vite.config.ts`: Build config, path aliases (@/), dev server port
- `tsconfig.json`: TypeScript strict mode, module resolution
- `tailwind.config.ts`: Design tokens (colors, spacing, fonts)
- `vitest.config.ts`: Test runner config, excluding supabase/** from test discovery
- `.prettierrc`, `.eslintrc.js`: Code formatting and linting rules

**Core Logic:**
- `src/pages/Dashboard.tsx`: Main app state, active view management, onboarding check
- `src/hooks/useTeamData.ts`: Team agent state + Realtime subscriptions
- `src/hooks/useAgentWorkspace.ts`: Workspace file CRUD + auto-save with debounce
- `src/lib/sanitize.ts`: Prompt injection filtering (kept in sync with edge function version)

**Testing:**
- `src/__tests__/`: Vitest test files (same directory structure as src/)
  - `sanitize.test.ts`: Regex pattern tests (12 injection patterns)
  - `useTeamData.test.ts`: Hook logic tests with mocked Supabase
  - `heartbeatParser.test.ts`: Parsing logic tests

## Naming Conventions

**Files:**
- Components: PascalCase (`UserCard.tsx`, `DashboardSidebar.tsx`)
- Hooks: camelCase prefixed with `use` (`useTeamData.ts`, `useAgentWorkspace.ts`)
- Utilities: camelCase (`sanitize.ts`, `heartbeatParser.ts`)
- Pages: PascalCase (`Dashboard.tsx`, `Index.tsx`)
- Tests: filename.test.ts or filename.spec.ts (`sanitize.test.ts`)

**Directories:**
- Feature folders: camelCase or lowercase (`agents/`, `dashboard/`, `components/`)
- Subdirectories: hierarchy indicates containment (`components/agents/workspace/`)

**TypeScript Types:**
- Interfaces: PascalCase, `I` prefix optional (`UseAgentWorkspaceParams`, `TeamAgent`)
- Types: PascalCase (`Message`, `Attachment`, `SocialPost`)
- Enums: PascalCase (`ActiveView`)

**Functions:**
- React components: PascalCase (`AccountantAgent`, `ChatInterface`)
- Hooks: camelCase `use` prefix (`useTeamData`, `usePushSubscription`)
- Utilities: camelCase (`sanitizeWorkspaceContent`, `parseHeartbeatLog`)

## Where to Add New Code

**New Feature (e.g., new agent type):**
- Implementation: `src/components/agents/MyAgentName.tsx`
- Workspace editor: Reuse `src/components/agents/workspace/` components
- Hook if needed: `src/hooks/useMyAgentData.ts` (if specialized data fetching required)
- Tests: `src/__tests__/useMyAgentData.test.ts`
- Integration: Add to Dashboard.tsx renderContent() switch statement; add to DashboardSidebar menu

**New Page/Route:**
- Page component: `src/pages/MyPage.tsx`
- Sub-components: `src/components/my-page/` subdirectory
- Route definition: Add to `src/App.tsx` Routes section
- Tests: `src/__tests__/pages/MyPage.test.ts`

**New Hook:**
- Primary: `src/hooks/useMyFeature.ts`
- Tests: `src/__tests__/useMyFeature.test.ts`
- Import pattern: `import { useMyFeature } from "@/hooks/useMyFeature"`

**Shared Utility:**
- Primary: `src/lib/myUtility.ts` (frontend/vitest)
- Sync version: `supabase/functions/_shared/myUtility.ts` (if used by edge functions)
- Tests: `src/__tests__/myUtility.test.ts`
- Note: Edit BOTH files together; update sync checklist in comments

**Edge Function:**
- Primary: `supabase/functions/my-function/index.ts`
- Shared deps: Import from `../_shared/` (Deno relative imports)
- Tests: Not co-located; test via direct Deno run or integration tests in frontend tests
- Entry: HTTP POST/GET handler; signature: `(req: Request) => Promise<Response>`

**UI Component (shadcn base):**
- Primary: `src/components/ui/my-component.tsx`
- Source: Generated via `shadcn-ui add [component]`
- Modifications: Apply only Tailwind class overrides; preserve Radix API

**Test:**
- Co-located: `src/__tests__/` mirrors `src/` structure
- Example: Test for `src/lib/sanitize.ts` goes in `src/__tests__/sanitize.test.ts`
- Pattern: Import test subject, mock Supabase if needed, use vitest describe/it/expect

## Special Directories

**src/__tests__/:**
- Purpose: Vitest test suite (mirrors src/ structure)
- Generated: No
- Committed: Yes
- Note: vitest.config.ts excludes supabase/** so only frontend code is tested

**dist/:**
- Purpose: Built JavaScript, CSS, static assets (output of `npm run build`)
- Generated: Yes (via Vite)
- Committed: No (.gitignored)
- Note: Use `vite preview` to test production build locally

**node_modules/:**
- Purpose: Dependencies installed by npm
- Generated: Yes (via `npm install`)
- Committed: No (.gitignored)

**supabase/migrations/:**
- Purpose: Database schema change history (SQL migrations)
- Generated: Semi (created manually, applied by Supabase)
- Committed: Yes
- Note: Never alter existing migrations; create new ones for schema changes

**public/:**
- Purpose: Static assets served at root (not bundled)
- Generated: No
- Committed: Yes
- Note: Use for large/infrequently-referenced assets (favicons, manifests)

---

*Structure analysis: 2026-03-18*
