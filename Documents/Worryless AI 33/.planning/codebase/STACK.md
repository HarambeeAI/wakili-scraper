# Technology Stack

**Analysis Date:** 2026-03-12

## Languages

**Primary:**
- TypeScript 5.8.x - Frontend React application (`src/`)
- TypeScript (Deno) - Supabase Edge Functions (`supabase/functions/`)

**Secondary:**
- SQL (PostgreSQL) - Database schema and migrations (`supabase/migrations/`)
- HTML - App shell entry point (`index.html`)

## Runtime

**Frontend:**
- Browser (SPA via Vite dev server, port 8080)

**Edge Functions:**
- Deno (via Supabase Edge Runtime) - All backend logic runs as Deno-based serverless functions
- Deno standard library: `https://deno.land/std@0.168.0` and `@0.190.0` (inconsistently versioned across functions)

**Package Manager:**
- npm (lockfile: `package-lock.json`)
- bun also present (`bun.lockb`) - dual lockfiles indicate both have been used

## Frameworks

**Core Frontend:**
- React 18.3.1 - UI framework
- React Router DOM 6.30.1 - Client-side routing (`src/pages/`)
- Vite 5.4.19 - Build tool and dev server (`vite.config.ts`)
- `@vitejs/plugin-react-swc` 3.11.x - React transform via SWC (fast builds)

**Component Library:**
- shadcn/ui pattern - Radix UI primitives + Tailwind CSS utilities
- Radix UI - Full suite of headless components (`@radix-ui/*`, 25+ packages)
- `components.json` - shadcn/ui config present

**Styling:**
- Tailwind CSS 3.4.17 (`tailwind.config.ts`)
- `tailwindcss-animate` - Animation utilities
- `@tailwindcss/typography` - Prose styling
- CSS custom properties for theming (HSL-based design tokens)
- Primary font: Montserrat; Serif: Cormorant Garamond; Mono: IBM Plex Mono

**State & Data:**
- TanStack Query (React Query) 5.83.0 - Server state, caching, async data
- React Hook Form 7.61.1 + `@hookform/resolvers` + Zod 3.25.x - Form state and validation

**Testing:**
- Not detected - No test framework in `package.json`, no test files found

**Build/Dev:**
- `lovable-tagger` 1.1.11 - Lovable platform dev plugin (component tagging, dev-only)
- ESLint 9.32.0 + `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`
- PostCSS 8.5.6 + Autoprefixer

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.86.0 - Database, auth, and edge function client
- `react-router-dom` 6.30.1 - All navigation routing
- `@tanstack/react-query` 5.83.0 - Data fetching and caching layer
- `zod` 3.25.76 - Schema validation (forms and API contracts)

**UI Utilities:**
- `lucide-react` 0.462.0 - Icon set
- `sonner` 1.7.4 - Toast notifications
- `react-markdown` 10.1.0 - Render AI-generated markdown responses
- `recharts` 2.15.4 - Charts for financial dashboards
- `date-fns` 3.6.0 - Date formatting and manipulation
- `react-day-picker` 8.10.1 - Calendar picker
- `class-variance-authority` + `clsx` + `tailwind-merge` - Class name utilities
- `cmdk` 1.1.1 - Command palette
- `vaul` 0.9.9 - Drawer component
- `embla-carousel-react` 8.6.0 - Carousel
- `input-otp` 1.4.2 - OTP input
- `react-resizable-panels` 2.1.9 - Resizable panel layout
- `next-themes` 0.3.0 - Dark/light theme management

**Edge Function Dependencies (loaded via esm.sh at runtime):**
- `@supabase/supabase-js@2.39.3` / `@2.86.0` - Supabase client in edge functions
- `resend@2.0.0` - Email sending SDK used in `send-daily-briefing`

## Configuration

**Environment (Frontend):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key
- Accessed via `import.meta.env.*` in `src/integrations/supabase/client.ts`

**Environment (Edge Functions - Deno.env):**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Admin-level Supabase key (used in all edge functions)
- `LOVABLE_API_KEY` - Lovable AI Gateway authentication key
- `RESEND_API_KEY` - Resend email service key
- `APIFY_API_TOKEN` - Apify lead scraping API key
- `FIRECRAWL_API_KEY` - Firecrawl web scraping API key

**Build:**
- `vite.config.ts` - Vite config; `@` alias maps to `./src`; dev server on port 8080
- `tsconfig.json` - TypeScript project references; `@/*` path alias; relaxed strictness (`noImplicitAny: false`, `strictNullChecks: false`)
- `tsconfig.app.json` + `tsconfig.node.json` - Split configs for app and build tooling
- `postcss.config.js` - PostCSS with Tailwind and Autoprefixer

## Platform Requirements

**Development:**
- Node.js (compatible with Vite 5, TypeScript 5.8)
- npm or bun as package manager

**Production:**
- Frontend: Lovable platform hosting (Lovable.dev) - inferred from `lovable-tagger`, OG image URLs, and `appUrl` construction in edge functions
- Backend: Supabase hosted project (Edge Functions + PostgreSQL + Auth + Storage)
- No Dockerfile, `vercel.json`, `netlify.toml`, or `railway.toml` present in the frontend project

---

*Stack analysis: 2026-03-12*
