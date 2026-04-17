# Worryless AI — Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate from Vite SPA to Next.js App Router and build the onboarding wizard + LangGraph brand DNA agent + streaming chat UI.

**Architecture:** Next.js App Router with route groups for marketing (public), auth, and app (authenticated). LangGraph orchestrates a multi-node agent that crawls websites via Firecrawl, searches the web via Serper, and generates 4 brand DNA markdown files + logo extraction using Gemini 3 Pro (multimodal) via OpenRouter. Results stream to a 3-panel chat UI via SSE.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4, BetterAuth 1.6, Drizzle ORM, PostgreSQL, LangGraph 1.2, Firecrawl 4.18, Serper API, OpenRouter (Gemini 3 Pro)

---

## File Structure Overview

### New Files to Create

```
src/app/layout.tsx                          — Root layout with Inter Tight font
src/app/globals.css                         — Ported from current index.css
src/app/(marketing)/layout.tsx              — Marketing layout (no sidebar)
src/app/(marketing)/page.tsx                — Landing page (ported from App.tsx)
src/app/(auth)/login/page.tsx               — Login page
src/app/(auth)/signup/page.tsx              — Signup page
src/app/(auth)/onboarding/page.tsx          — Onboarding wizard
src/app/(app)/layout.tsx                    — App shell layout
src/app/(app)/[orgSlug]/chat/page.tsx       — Chat page
src/app/api/auth/[...all]/route.ts          — BetterAuth catch-all
src/app/api/agent/start/route.ts            — POST: trigger agent run
src/app/api/agent/stream/[runId]/route.ts   — GET: SSE stream
src/app/api/brand-files/[orgId]/route.ts    — GET: brand files

src/components/marketing/*.tsx              — Ported landing page components
src/components/onboarding/OnboardingStepper.tsx
src/components/onboarding/WebsiteStep.tsx
src/components/onboarding/ServicesStep.tsx
src/components/onboarding/PlatformsStep.tsx
src/components/chat/ChatLayout.tsx
src/components/chat/ChatSidebar.tsx
src/components/chat/ChatMessages.tsx
src/components/chat/ChatMessage.tsx
src/components/chat/FileCard.tsx
src/components/chat/StatusIndicator.tsx
src/components/chat/KnowledgePanel.tsx
src/components/chat/ChatInput.tsx
src/components/ui/Button.tsx
src/components/ui/Input.tsx
src/components/ui/Card.tsx
src/components/ui/Stepper.tsx

src/lib/auth.ts                             — BetterAuth server config
src/lib/auth-client.ts                      — BetterAuth client
src/lib/db/index.ts                         — Drizzle client
src/lib/db/schema.ts                        — All table schemas
src/lib/agent/graph.ts                      — LangGraph definition
src/lib/agent/state.ts                      — Agent state schema
src/lib/agent/nodes/plan-tasks.ts
src/lib/agent/nodes/crawl-website.ts
src/lib/agent/nodes/extract-brand.ts
src/lib/agent/nodes/generate-profile.ts
src/lib/agent/nodes/research-market.ts
src/lib/agent/nodes/generate-strategy.ts
src/lib/agent/nodes/synthesize.ts
src/lib/agent/tools/firecrawl.ts
src/lib/agent/tools/serper.ts
src/lib/agent/prompts/brand-guidelines.ts
src/lib/agent/prompts/business-profile.ts
src/lib/agent/prompts/market-research.ts
src/lib/agent/prompts/marketing-strategy.ts

src/hooks/useSSE.ts
src/hooks/useOnboarding.ts
src/types/index.ts

middleware.ts                               — Auth + onboarding guards
next.config.ts
tailwind.config.ts
drizzle.config.ts
.env.local
```

### Files to Delete (after migration)

```
src/App.tsx
src/main.tsx
src/index.css (content moves to globals.css)
index.html
vite.config.ts
```

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `next.config.ts`, `tailwind.config.ts`, `.env.local`, `src/app/layout.tsx`, `src/app/globals.css`
- Modify: `package.json`, `tsconfig.json`
- Delete: `vite.config.ts`, `index.html`, `src/main.tsx`

- [ ] **Step 1: Install Next.js and update dependencies**

```bash
cd /Users/anthonysure/Desktop/worryless-ai
npm install next@latest react@latest react-dom@latest
npm install -D @types/node tailwindcss@latest @tailwindcss/postcss postcss
npm uninstall @vitejs/plugin-react @tailwindcss/vite vite
```

- [ ] **Step 2: Update package.json scripts**

Replace the `"scripts"` block in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

- [ ] **Step 3: Create next.config.ts**

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create postcss.config.mjs**

```javascript
// postcss.config.mjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 5: Create src/app/globals.css**

Copy the entire contents of `src/index.css` into `src/app/globals.css`. The file starts with `@import "tailwindcss";` and includes the `@theme` block with all color tokens and the animation/utility classes. No changes to the CSS content.

- [ ] **Step 6: Create src/app/layout.tsx**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Worryless AI: AI Marketing Agents That Execute 24/7",
  description: "Hire your first autonomous AI marketer today.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;450;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Update tsconfig.json for Next.js**

Replace `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 8: Create .env.local**

```bash
# Auth
BETTER_AUTH_SECRET=generate-a-random-secret-here
BETTER_AUTH_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/worryless

# AI / APIs
OPENROUTER_API_KEY=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
FIRECRAWL_API_KEY=fc-a7e37137c9b14b35bff603099c288769
SERPER_API_KEY=e4973ffa26a41fc0e0a13337631da60dafc1a47e

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 9: Delete Vite files**

```bash
rm vite.config.ts index.html src/main.tsx src/App.tsx
rm -f tsconfig.app.json tsconfig.node.json
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: migrate from Vite to Next.js App Router scaffold"
```

---

## Task 2: Port Landing Page Components

**Files:**
- Move: All `src/components/*.tsx` → `src/components/marketing/*.tsx`
- Create: `src/app/(marketing)/layout.tsx`, `src/app/(marketing)/page.tsx`

- [ ] **Step 1: Move component files to marketing directory**

```bash
cd /Users/anthonysure/Desktop/worryless-ai
mkdir -p src/components/marketing
mv src/components/Navbar.tsx src/components/marketing/
mv src/components/Hero.tsx src/components/marketing/
mv src/components/LogoBar.tsx src/components/marketing/
mv src/components/HowWeWork.tsx src/components/marketing/
mv src/components/Capabilities.tsx src/components/marketing/
mv src/components/WhyUs.tsx src/components/marketing/
mv src/components/Agents.tsx src/components/marketing/
mv src/components/Solutions.tsx src/components/marketing/
mv src/components/Stats.tsx src/components/marketing/
mv src/components/Testimonials.tsx src/components/marketing/
mv src/components/CTA.tsx src/components/marketing/
mv src/components/Footer.tsx src/components/marketing/
```

- [ ] **Step 2: Add "use client" directive to interactive components**

Components that use `useState`, `useEffect`, or event handlers need `"use client"` at the top. Add `"use client";` as the first line of these files:

- `src/components/marketing/Navbar.tsx` (uses useState for mobile menu)
- `src/components/marketing/Hero.tsx` (uses useState for active agent)
- `src/components/marketing/WhyUs.tsx` (uses useState for tab switching)
- `src/components/marketing/Testimonials.tsx` (uses animation/hover)

Static components (LogoBar, HowWeWork, Capabilities, Agents, Solutions, Stats, CTA, Footer) do not need the directive.

- [ ] **Step 3: Create marketing layout**

```tsx
// src/app/(marketing)/layout.tsx
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

- [ ] **Step 4: Create marketing page**

```tsx
// src/app/(marketing)/page.tsx
import Navbar from "@/components/marketing/Navbar";
import Hero from "@/components/marketing/Hero";
import LogoBar from "@/components/marketing/LogoBar";
import HowWeWork from "@/components/marketing/HowWeWork";
import Capabilities from "@/components/marketing/Capabilities";
import WhyUs from "@/components/marketing/WhyUs";
import Agents from "@/components/marketing/Agents";
import Solutions from "@/components/marketing/Solutions";
import Stats from "@/components/marketing/Stats";
import Testimonials from "@/components/marketing/Testimonials";
import CTA from "@/components/marketing/CTA";
import Footer from "@/components/marketing/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <Navbar />
      <Hero />
      <LogoBar />
      <HowWeWork />
      <Capabilities />
      <WhyUs />
      <Agents />
      <Solutions />
      <Stats />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
}
```

- [ ] **Step 5: Run dev server and verify landing page renders**

```bash
npm run dev
```

Open http://localhost:3000 — the landing page should render identically to the Vite version.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: port landing page to Next.js App Router"
```

---

## Task 3: Database Setup with Drizzle

**Files:**
- Create: `src/lib/db/index.ts`, `src/lib/db/schema.ts`, `drizzle.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Drizzle dependencies**

```bash
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg
```

- [ ] **Step 2: Create drizzle.config.ts**

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 3: Create database schema**

```typescript
// src/lib/db/schema.ts
import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  websiteUrl: text("website_url"),
  logoUrl: text("logo_url"),
  selectedServices: jsonb("selected_services").$type<string[]>(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const brandFiles = pgTable("brand_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  type: text("type", {
    enum: ["business_profile", "brand_guidelines", "market_research", "marketing_strategy"],
  }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  role: text("role", { enum: ["agent", "user", "system"] }).notNull(),
  content: text("content").notNull(),
  type: text("type", { enum: ["text", "file_card", "status"] }).notNull(),
  fileId: uuid("file_id").references(() => brandFiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"],
  }).notNull().default("pending"),
  tasks: jsonb("tasks").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
```

- [ ] **Step 4: Create database client**

```typescript
// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle(pool, { schema });
```

- [ ] **Step 5: Add db scripts to package.json**

Add to the `"scripts"` section:

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
}
```

- [ ] **Step 6: Generate initial migration**

```bash
npx drizzle-kit generate
```

Expected: Creates migration files in `drizzle/` directory.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle ORM with PostgreSQL schema"
```

---

## Task 4: BetterAuth Setup

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`
- Modify: `package.json`

- [ ] **Step 1: Install BetterAuth**

```bash
npm install better-auth
```

- [ ] **Step 2: Create auth server config**

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
    }),
  ],
});
```

- [ ] **Step 3: Create auth client**

```typescript
// src/lib/auth-client.ts
"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [organizationClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  useActiveOrganization,
} = authClient;
```

- [ ] **Step 4: Create auth API route**

```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 5: Generate BetterAuth tables**

```bash
npx @better-auth/cli generate
```

This generates the BetterAuth tables (user, session, account, organization, member, invitation) and adds them to your Drizzle schema or creates a separate auth schema file.

- [ ] **Step 6: Push schema to database**

```bash
npx drizzle-kit push
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add BetterAuth with organization plugin"
```

---

## Task 5: Auth Pages (Login & Signup)

**Files:**
- Create: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`
- Create: `src/components/ui/Button.tsx`, `src/components/ui/Input.tsx`

- [ ] **Step 1: Create shared UI components**

```tsx
// src/components/ui/Button.tsx
"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", isLoading, children, disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
      primary: "btn-primary text-white",
      secondary: "bg-white text-dark border border-border hover:bg-light",
      ghost: "text-muted-dark hover:text-dark hover:bg-light",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
```

```tsx
// src/components/ui/Input.tsx
"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-dark mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-dark placeholder:text-muted outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 ${
            error ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
```

- [ ] **Step 2: Create auth layout**

```tsx
// src/app/(auth)/layout.tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create signup page**

```tsx
// src/app/(auth)/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signUp.email({
        name,
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Something went wrong");
        return;
      }

      router.push("/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl section-card p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-dark">Create your account</h1>
          <p className="text-muted-dark mt-2 text-sm">
            Get started with your AI marketing team
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label="Full name"
            type="text"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="jane@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="Min 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full">
            Get Started
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-dark">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create login page**

```tsx
// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Invalid credentials");
        return;
      }

      router.push("/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl section-card p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-dark">Welcome back</h1>
          <p className="text-muted-dark mt-2 text-sm">
            Log in to your Worryless AI account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="jane@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full">
            Log in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-dark">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add login and signup pages with BetterAuth"
```

---

## Task 6: Onboarding Wizard

**Files:**
- Create: `src/app/(auth)/onboarding/page.tsx`, `src/components/onboarding/OnboardingStepper.tsx`, `src/components/onboarding/WebsiteStep.tsx`, `src/components/onboarding/ServicesStep.tsx`, `src/components/onboarding/PlatformsStep.tsx`, `src/components/ui/Stepper.tsx`, `src/hooks/useOnboarding.ts`, `src/types/index.ts`

- [ ] **Step 1: Create shared types**

```typescript
// src/types/index.ts
export type Service = "social_media" | "seo" | "content_writing" | "email_marketing" | "paid_ads";

export interface OnboardingData {
  websiteUrl: string;
  selectedServices: Service[];
  connectedPlatforms: string[];
}

export type BrandFileType = "business_profile" | "brand_guidelines" | "market_research" | "marketing_strategy";

export interface BrandFile {
  id: string;
  type: BrandFileType;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ChatMessageData {
  id: string;
  role: "agent" | "user" | "system";
  content: string;
  type: "text" | "file_card" | "status";
  fileId?: string;
  file?: BrandFile;
  createdAt: string;
}

export type SSEEvent =
  | { event: "status"; data: { task: string; message: string } }
  | { event: "message"; data: { role: string; content: string } }
  | { event: "file_card"; data: { fileId: string; type: BrandFileType; title: string; content: string } }
  | { event: "complete"; data: { status: string; filesGenerated: number } }
  | { event: "error"; data: { message: string } };
```

- [ ] **Step 2: Create onboarding hook**

```typescript
// src/hooks/useOnboarding.ts
"use client";

import { useState } from "react";
import type { OnboardingData, Service } from "@/types";

const ALL_SERVICES: Service[] = [
  "social_media",
  "seo",
  "content_writing",
  "email_marketing",
  "paid_ads",
];

export function useOnboarding() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    websiteUrl: "",
    selectedServices: [...ALL_SERVICES],
    connectedPlatforms: [],
  });

  function updateData(partial: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function nextStep() {
    setStep((s) => Math.min(s + 1, 3));
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 1));
  }

  return { step, data, updateData, nextStep, prevStep };
}
```

- [ ] **Step 3: Create Stepper UI component**

```tsx
// src/components/ui/Stepper.tsx
"use client";

interface StepperProps {
  currentStep: number;
  totalSteps: number;
}

export default function Stepper({ currentStep, totalSteps }: StepperProps) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={stepNum} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary text-white"
                  : isCompleted
                  ? "bg-primary/20 text-primary"
                  : "bg-light text-muted"
              }`}
            >
              {isCompleted ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                stepNum
              )}
            </div>
            {stepNum < totalSteps && (
              <div
                className={`w-12 h-0.5 ${
                  isCompleted ? "bg-primary/30" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create WebsiteStep component**

```tsx
// src/components/onboarding/WebsiteStep.tsx
"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface WebsiteStepProps {
  value: string;
  onChange: (url: string) => void;
  onNext: () => void;
}

export default function WebsiteStep({ value, onChange, onNext }: WebsiteStepProps) {
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const url = value.startsWith("http") ? value : `https://${value}`;
      new URL(url);
      onChange(url);
      onNext();
    } catch {
      setError("Please enter a valid URL");
    }
  }

  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold text-dark mb-2">
        What&apos;s your website?
      </h1>
      <p className="text-muted-dark text-sm mb-8">
        We&apos;ll analyze your brand, market, and competition
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          id="website"
          type="text"
          placeholder="https://yourcompany.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={error}
          className="text-center"
          required
        />
        <Button type="submit" className="w-full">
          Continue
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Create ServicesStep component**

```tsx
// src/components/onboarding/ServicesStep.tsx
"use client";

import type { Service } from "@/types";
import Button from "@/components/ui/Button";

interface ServicesStepProps {
  selected: Service[];
  onChange: (services: Service[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const SERVICES: { id: Service; label: string; icon: string }[] = [
  { id: "social_media", label: "Social Media", icon: "\uD83D\uDCF1" },
  { id: "seo", label: "SEO", icon: "\uD83D\uDD0D" },
  { id: "content_writing", label: "Content Writing", icon: "\u270D\uFE0F" },
  { id: "email_marketing", label: "Email Marketing", icon: "\uD83D\uDCE7" },
  { id: "paid_ads", label: "Paid Ads", icon: "\uD83D\uDCE3" },
];

export default function ServicesStep({ selected, onChange, onNext, onBack }: ServicesStepProps) {
  function toggleService(id: Service) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold text-dark mb-2">
        What do you need help with?
      </h1>
      <p className="text-muted-dark text-sm mb-8">
        Select all that apply. This helps Helena focus on what matters most.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-8 sm:grid-cols-3">
        {SERVICES.map((service) => {
          const isSelected = selected.includes(service.id);
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => toggleService(service.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 text-dark"
                  : "border-border bg-white text-muted-dark hover:border-muted"
              }`}
            >
              <span className="text-2xl">{service.icon}</span>
              <span className="text-sm font-medium">{service.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={selected.length === 0}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create PlatformsStep component**

```tsx
// src/components/onboarding/PlatformsStep.tsx
"use client";

import Button from "@/components/ui/Button";

interface PlatformsStepProps {
  onFinish: () => void;
  onBack: () => void;
  isLoading: boolean;
}

const PLATFORMS = [
  { id: "google_analytics", label: "Google Analytics", icon: "\uD83D\uDCCA" },
  { id: "instagram", label: "Instagram", icon: "\uD83D\uDCF7" },
  { id: "facebook", label: "Facebook", icon: "\uD83D\uDC4D" },
  { id: "linkedin", label: "LinkedIn", icon: "\uD83D\uDCBC" },
  { id: "twitter", label: "X / Twitter", icon: "\uD83D\uDCAC" },
];

export default function PlatformsStep({ onFinish, onBack, isLoading }: PlatformsStepProps) {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-semibold text-dark mb-2">
        Connect your platforms
      </h1>
      <p className="text-muted-dark text-sm mb-8">
        Optional — you can always connect these later
      </p>

      <div className="space-y-3 mb-8">
        {PLATFORMS.map((platform) => (
          <div
            key={platform.id}
            className="flex items-center justify-between p-4 rounded-xl border border-border bg-white"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{platform.icon}</span>
              <span className="text-sm font-medium text-dark">{platform.label}</span>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => {
                // Future: OAuth flow
              }}
            >
              Connect now
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onFinish} isLoading={isLoading} className="flex-1">
          Start Analysis
        </Button>
      </div>

      <button
        type="button"
        onClick={onFinish}
        disabled={isLoading}
        className="mt-4 text-sm text-muted-dark hover:text-dark transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Create OnboardingStepper component**

```tsx
// src/components/onboarding/OnboardingStepper.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useActiveOrganization } from "@/lib/auth-client";
import Stepper from "@/components/ui/Stepper";
import WebsiteStep from "./WebsiteStep";
import ServicesStep from "./ServicesStep";
import PlatformsStep from "./PlatformsStep";

export default function OnboardingStepper() {
  const router = useRouter();
  const { step, data, updateData, nextStep, prevStep } = useOnboarding();
  const { data: org } = useActiveOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleFinish() {
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/agent/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org?.id,
          websiteUrl: data.websiteUrl,
          selectedServices: data.selectedServices,
        }),
      });

      if (!res.ok) throw new Error("Failed to start agent");

      const { orgSlug } = await res.json();
      router.push(`/app/${orgSlug}/chat`);
    } catch (error) {
      console.error("Onboarding error:", error);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-white rounded-2xl section-card p-8">
        <div className="flex justify-center">
          <Stepper currentStep={step} totalSteps={3} />
        </div>

        {step === 1 && (
          <WebsiteStep
            value={data.websiteUrl}
            onChange={(url) => updateData({ websiteUrl: url })}
            onNext={nextStep}
          />
        )}

        {step === 2 && (
          <ServicesStep
            selected={data.selectedServices}
            onChange={(services) => updateData({ selectedServices: services })}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {step === 3 && (
          <PlatformsStep
            onFinish={handleFinish}
            onBack={prevStep}
            isLoading={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create onboarding page**

```tsx
// src/app/(auth)/onboarding/page.tsx
import OnboardingStepper from "@/components/onboarding/OnboardingStepper";

export default function OnboardingPage() {
  return <OnboardingStepper />;
}
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add 3-step onboarding wizard"
```

---

## Task 7: Agent Tools (Firecrawl + Serper)

**Files:**
- Create: `src/lib/agent/tools/firecrawl.ts`, `src/lib/agent/tools/serper.ts`
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
npm install @mendable/firecrawl-js @langchain/langgraph @langchain/core @langchain/openai
```

- [ ] **Step 2: Create Firecrawl tool**

```typescript
// src/lib/agent/tools/firecrawl.ts
import FirecrawlApp from "@mendable/firecrawl-js";

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY!,
});

export interface CrawlResult {
  content: string;
  html: string;
  screenshot?: string;
  metadata: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
}

export async function scrapeWebsite(url: string): Promise<CrawlResult> {
  const result = await firecrawl.scrapeUrl(url, {
    formats: ["markdown", "html", "screenshot"],
  });

  if (!result.success) {
    throw new Error(`Firecrawl scrape failed: ${result.error}`);
  }

  return {
    content: result.markdown || "",
    html: result.html || "",
    screenshot: result.screenshot,
    metadata: {
      title: result.metadata?.title,
      description: result.metadata?.description,
      ogImage: result.metadata?.ogImage,
    },
  };
}

export function extractLogoFromHtml(html: string, baseUrl: string): string | null {
  const patterns = [
    // Link rel="icon" or apple-touch-icon
    /<link[^>]*rel=["'](?:icon|apple-touch-icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/gi,
    // Img in header/nav with "logo" in attributes
    /<(?:header|nav)[^>]*>[\s\S]*?<img[^>]*(?:class|alt|src)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/gi,
    /<img[^>]*src=["']([^"']+)["'][^>]*(?:class|alt)=["'][^"']*logo[^"']*["']/gi,
    // OG image as fallback
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      const logoPath = match[1];
      if (logoPath.startsWith("http")) return logoPath;
      if (logoPath.startsWith("//")) return `https:${logoPath}`;
      return new URL(logoPath, baseUrl).toString();
    }
  }

  return null;
}

export function extractStylesFromHtml(html: string): {
  colors: string[];
  fonts: string[];
} {
  const colorPattern = /#[0-9a-fA-F]{3,8}/g;
  const fontPattern = /font-family:\s*["']?([^;"']+)/g;

  const colors = [...new Set(html.match(colorPattern) || [])];
  const fonts: string[] = [];
  let fontMatch;
  while ((fontMatch = fontPattern.exec(html)) !== null) {
    const font = fontMatch[1].split(",")[0].trim().replace(/["']/g, "");
    if (!fonts.includes(font)) fonts.push(font);
  }

  return { colors, fonts };
}
```

- [ ] **Step 3: Create Serper tool**

```typescript
// src/lib/agent/tools/serper.ts
interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

interface SerperResponse {
  organic: SerperResult[];
  knowledgeGraph?: {
    title?: string;
    description?: string;
  };
}

export async function searchWeb(query: string, numResults = 10): Promise<SerperResult[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: numResults,
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper search failed: ${response.statusText}`);
  }

  const data: SerperResponse = await response.json();
  return data.organic || [];
}

export async function searchMultiple(queries: string[]): Promise<Record<string, SerperResult[]>> {
  const results: Record<string, SerperResult[]> = {};

  await Promise.all(
    queries.map(async (query) => {
      results[query] = await searchWeb(query);
    })
  );

  return results;
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Firecrawl and Serper agent tools"
```

---

## Task 8: Agent Prompts

**Files:**
- Create: `src/lib/agent/prompts/business-profile.ts`, `src/lib/agent/prompts/brand-guidelines.ts`, `src/lib/agent/prompts/market-research.ts`, `src/lib/agent/prompts/marketing-strategy.ts`

- [ ] **Step 1: Create business profile prompt**

```typescript
// src/lib/agent/prompts/business-profile.ts
export const BUSINESS_PROFILE_PROMPT = `You are an expert business analyst. Your task is to produce a comprehensive Business Profile document in markdown format for a company based on their website content and any additional search results provided.

## Required Output Structure

You MUST follow this exact markdown structure:

# [Company Name] — Business Profile

## Overview
- **Product:** [One-line product description]
- **Tagline:** "[Exact tagline from website]"
- **Category:** [Industry / Business Type]
- **Market:** [Primary market]; [expansion markets if mentioned]
- **Website:** [URL]

## Traction
- [List specific numbers found on the site: users, revenue, documents processed, etc.]
- [If press coverage is mentioned, list publications]
- [If no traction data, note "Early-stage — no public metrics yet"]

## Core Product Features
1. **[Feature Name]** — [1-sentence description of what it does and why it matters]
2. **[Feature Name]** — [description]
[List ALL features found on the site, numbered]

## Pricing
| Plan | Price | Target |
|------|-------|--------|
| [Plan name] | [Price] | [Who it's for] |
[Extract ALL pricing tiers. If no pricing is public, note "Pricing not publicly listed — contact sales model"]

## Key Value Props (by segment)
- **[Segment 1]:** [Specific benefit with metrics if available]
- **[Segment 2]:** [Specific benefit]
[Identify 3-4 audience segments and match value props to each]

## Marketing Goals
[List the marketing channels/goals evident from the site: email, SEO, social, etc.]

## CTAs on Site
- Primary: "[CTA text]" → [where it links]
- Secondary: "[CTA text]" → [where it links]

## Rules
- Always include SPECIFIC numbers. If the site says "500+ customers", write "500+ customers" not "many customers"
- Extract exact pricing in the local currency shown on the site
- If data isn't available, say so explicitly — never fabricate metrics
- Keep descriptions concise — one line per feature, one line per value prop
- Use the company's own language and terminology`;
```

- [ ] **Step 2: Create brand guidelines prompt**

```typescript
// src/lib/agent/prompts/brand-guidelines.ts
export const BRAND_GUIDELINES_PROMPT = `You are an expert brand designer and UI analyst. Your task is to produce a comprehensive Brand Guidelines document by analyzing a website's visual design, screenshots, and extracted CSS data.

## Required Output Structure

# [Company Name] — Brand Guidelines

## Brand Personality
- **Tone:** [e.g., Professional, confident, precision-driven]
- **Energy:** [e.g., Medium — authoritative but approachable]
- **Audience:** [Primary audience description]
- **Voice:** [Key brand voice descriptors — e.g., "unfair advantage", "AI-native", "precision"]

## Colors
| Role | Hex | Usage |
|------|-----|-------|
| Primary | \`#XXXXXX\` | [Where it's used: CTAs, links, highlights] |
| Secondary | \`#XXXXXX\` | [Usage] |
| Background | \`#XXXXXX\` | [Usage] |
| Text Primary | \`#XXXXXX\` | [Usage] |
| Muted Text | \`#XXXXXX\` | [Usage] |
[Include ALL significant colors found. Minimum 5 rows.]

## Typography
| Role | Font |
|------|------|
| Headings | [Font name] |
| Body | [Font name] |
| Monospace / UI | [Font name, if applicable] |

## Logo
- Icon: [URL if found]
- Favicon: [URL if found]

## UI Components
- **Primary Button:** [bg color] bg, [text color] text, [border-radius], [shadow description]
- **Secondary Button:** [bg color] bg, [text color] text, [border-radius]
- **Border Radius (cards):** [Value]
- **Card Shadows:** [Description of shadow style]

## Content Guidelines
- [3-5 bullet points about messaging patterns observed on the site]
- [What language/terms do they use?]
- [What do they emphasize?]
- [What tone do they avoid?]
- [Hero messaging pattern observed]

## Rules
- Extract EXACT hex codes from the CSS/HTML data provided, not approximations
- Identify fonts from the CSS font-family declarations and Google Fonts imports
- For the brand personality section, analyze the overall look/feel from screenshots
- If you're analyzing screenshots, describe the visual energy and design approach
- Include all colors that appear more than once — don't just list primary/secondary
- Note specific border-radius values, not just "rounded"`;
```

- [ ] **Step 3: Create market research prompt**

```typescript
// src/lib/agent/prompts/market-research.ts
export const MARKET_RESEARCH_PROMPT = `You are a senior market research analyst. Your task is to produce a comprehensive Market Research document for a company based on web search results, the company's website content, and their industry context.

## Required Output Structure

# [Company Name] — Market Research

## Market Size & Opportunity
- [Industry market size with dollar figure and source hint]
- [Global/regional market for their specific niche with CAGR if found]
- [Country/region specific market projections]
- [Growth drivers or tailwinds]
[ALWAYS include specific dollar figures. Search for "[industry] market size [year]" data]

## Target Segments (Priority Order)
1. **[Segment name]** — [size/volume], [price sensitivity], [why they're #1]
2. **[Segment name]** — [characteristics], [why they're #2]
3. **[Segment name]** — [characteristics]
4. **[Segment name]** — [characteristics]
[Rank by opportunity size. Include reasoning for the ranking.]

## Competitive Landscape
### Direct Local Competition
- **[Competitor]** — [one-line description, how they compare]
- If none: "**No known direct competitors** in [specific niche] — [Company] appears to own this category"

### Indirect / Global Competitors
- **[Competitor]** — [description]; [why they're not a direct threat]
- **[Competitor]** — [description]
[List 3-5 indirect competitors with positioning notes]

### [Company]'s Moat
- [Specific competitive advantage #1]
- [Specific competitive advantage #2]
- [Specific competitive advantage #3]

## Keyword Landscape (Google Ads data if available)
| Keyword | Monthly Volume | Competition |
|---------|---------------|-------------|
| [keyword] | [number] | [LOW/MEDIUM/HIGH] |
[Include 5-8 relevant keywords. Note the key insight about search volume trends]

**Key insight:** [One paragraph interpreting what the keyword data means for strategy]

## Audience Pain Points (from site metrics + market data)
- [Pain point #1 with specific data if available]
- [Pain point #2]
- [Pain point #3]
- [Pain point #4]
- [Pain point #5]

## Channels That Work for [Industry] in [Region]
1. [Channel] ([why it works for this market])
2. [Channel] ([reasoning])
3. [Channel] ([reasoning])
4. [Channel] ([reasoning])
5. [Channel] ([reasoning])

## Rules
- Every market size claim MUST include a dollar figure or range
- Competitor analysis must include positioning relative to the company
- Keyword data should reflect actual search behavior, not assumptions
- If search data is unavailable for specific terms, note "low volume — category building" rather than making up numbers
- Pain points should be grounded in what the site and search data reveal, not generic industry pain points
- Rank everything — segments, channels, competitors by relevance`;
```

- [ ] **Step 4: Create marketing strategy prompt**

```typescript
// src/lib/agent/prompts/marketing-strategy.ts
export const MARKETING_STRATEGY_PROMPT = `You are a senior digital marketing strategist. Your task is to produce a comprehensive, actionable Marketing Strategy document. You have access to the company's business profile, brand guidelines, and market research — use these to ground every recommendation in real data.

## Required Output Structure

# [Company Name] — Marketing Strategy

## North Star Goal
[One sentence: what the company should aim to achieve in 12-18 months]

## Positioning
**"[One-line positioning statement]"**
[2-3 sentences explaining why this positioning works given the competitive landscape]

---

## 1. SEO & Content Strategy
**Goal:** [Specific SEO goal tied to market research findings]

### Priority Content Pillars
- **[Pillar]:** "[Example article title]"
- **[Pillar]:** "[Example article title]"
- **[Pillar]:** "[Example article title]"
- **[Pillar]:** "[Example article title]"
- **[Pillar]:** "[Example article title]"

### Quick SEO Wins
- [Specific, actionable win #1]
- [Specific, actionable win #2]
- [Specific, actionable win #3]
- [Blog cadence recommendation with reasoning]

---

## 2. Email Marketing
**Goal:** [Specific email goal]

### Key Flows to Build
1. **[Flow name]** ([duration]) — [what it does]
2. **[Flow name]** — [what it does]
3. **[Flow name]** — [what it does]
4. **[Flow name]** — [what it does]

### List Building
- [Tactic #1]
- [Tactic #2]
- [Tactic #3]

---

## 3. Paid Ads
**Recommended Channels:**
- **[Channel]** — [why, who to target]
- **[Channel]** — [why, specific targeting approach]
- **[Channel]** — [why]

### Ad Creative Angles
- [Angle]: "[Example ad copy line]"
- [Angle]: "[Example ad copy line]"
- [Angle]: "[Example ad copy line]"
- [Angle]: "[Example ad copy line]"

---

## 4. Social Media
**Priority Platforms:** [Platform list with primary/secondary]

### [Platform 1]
- [Tactic #1]
- [Tactic #2]
- [Tactic #3]

### [Platform 2]
- [Tactic #1]
- [Tactic #2]

### [Platform 3]
- [Tactic #1]
- [Tactic #2]

---

## 5. Conversion Rate Optimization
- [Specific CRO recommendation #1]
- [Specific CRO recommendation #2]
- [Specific CRO recommendation #3]
- [Specific CRO recommendation #4]

---

## Funnel Overview
| Stage | Tactic |
|-------|--------|
| Awareness | [Specific tactics] |
| Interest | [Specific tactics] |
| Decision | [Specific tactics] |
| Retention | [Specific tactics] |
| Expansion | [Specific tactics] |

---

## 30-Day Quick Wins
1. [Specific, actionable task with expected outcome]
2. [Specific task]
3. [Specific task]
4. [Specific task]
5. [Specific task]

## Rules
- Every recommendation MUST reference data from the business profile, brand guidelines, or market research
- Ad copy angles must use the brand voice from brand guidelines
- SEO recommendations must reference keywords from market research
- Channel recommendations must be justified by the audience/market data
- Quick wins must be achievable in 30 days — no multi-month initiatives
- Be opinionated: "Strategy must prioritize X over Y because Z"
- Include specific example content titles, ad copy lines, and email subject lines`;
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add agent prompts for brand DNA generation"
```

---

## Task 9: LangGraph Agent (State + Nodes + Graph)

**Files:**
- Create: `src/lib/agent/state.ts`, `src/lib/agent/nodes/plan-tasks.ts`, `src/lib/agent/nodes/crawl-website.ts`, `src/lib/agent/nodes/extract-brand.ts`, `src/lib/agent/nodes/generate-profile.ts`, `src/lib/agent/nodes/research-market.ts`, `src/lib/agent/nodes/generate-strategy.ts`, `src/lib/agent/nodes/synthesize.ts`, `src/lib/agent/graph.ts`

- [ ] **Step 1: Create agent state schema**

```typescript
// src/lib/agent/state.ts
import { Annotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  // Inputs
  websiteUrl: Annotation<string>,
  selectedServices: Annotation<string[]>,
  organizationId: Annotation<string>,

  // Crawled data
  crawledContent: Annotation<string>({ default: () => "" }),
  crawledHtml: Annotation<string>({ default: () => "" }),
  screenshots: Annotation<string[]>({ default: () => [] }),
  logoUrl: Annotation<string | null>({ default: () => null }),
  extractedStyles: Annotation<{ colors: string[]; fonts: string[] }>({
    default: () => ({ colors: [], fonts: [] }),
  }),
  siteMetadata: Annotation<Record<string, string | undefined>>({
    default: () => ({}),
  }),

  // Generated files
  businessProfile: Annotation<string>({ default: () => "" }),
  brandGuidelines: Annotation<string>({ default: () => "" }),
  marketResearch: Annotation<string>({ default: () => "" }),
  marketingStrategy: Annotation<string>({ default: () => "" }),

  // Streaming callbacks
  emitEvent: Annotation<
    (event: string, data: Record<string, unknown>) => void
  >,
});

export type AgentStateType = typeof AgentState.State;
```

- [ ] **Step 2: Create plan-tasks node**

```typescript
// src/lib/agent/nodes/plan-tasks.ts
import type { AgentStateType } from "../state";

export async function planTasks(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const domain = new URL(state.websiteUrl).hostname.replace("www.", "");
  const companyName = domain.split(".")[0];
  const capitalizedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);

  state.emitEvent("message", {
    role: "agent",
    content: `Let me dive right in — starting with your website and brand to get a clear picture of what ${capitalizedName} is all about.`,
  });

  state.emitEvent("status", {
    task: "plan_tasks",
    message: "Planning analysis tasks",
  });

  return {};
}
```

- [ ] **Step 3: Create crawl-website node**

```typescript
// src/lib/agent/nodes/crawl-website.ts
import type { AgentStateType } from "../state";
import { scrapeWebsite, extractLogoFromHtml, extractStylesFromHtml } from "../tools/firecrawl";

export async function crawlWebsite(state: AgentStateType): Promise<Partial<AgentStateType>> {
  state.emitEvent("status", {
    task: "crawl_website",
    message: "Working on getWebsiteContent",
  });

  const result = await scrapeWebsite(state.websiteUrl);

  const logoUrl = extractLogoFromHtml(result.html, state.websiteUrl);
  const extractedStyles = extractStylesFromHtml(result.html);

  state.emitEvent("message", {
    role: "agent",
    content: `Great picture forming already. I've scraped your website and found ${extractedStyles.colors.length} colors and ${extractedStyles.fonts.length} fonts in your design system.${logoUrl ? " Found your logo too." : ""}`,
  });

  return {
    crawledContent: result.content,
    crawledHtml: result.html,
    screenshots: result.screenshot ? [result.screenshot] : [],
    logoUrl,
    extractedStyles,
    siteMetadata: result.metadata,
  };
}
```

- [ ] **Step 4: Create extract-brand node**

```typescript
// src/lib/agent/nodes/extract-brand.ts
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../state";
import { BRAND_GUIDELINES_PROMPT } from "../prompts/brand-guidelines";

const llm = new ChatOpenAI({
  modelName: "google/gemini-2.5-pro-preview",
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  temperature: 0.3,
});

export async function extractBrand(state: AgentStateType): Promise<Partial<AgentStateType>> {
  state.emitEvent("status", {
    task: "extract_brand",
    message: "Analyzing brand identity and visual design",
  });

  const messageContent: (
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  )[] = [
    {
      type: "text",
      text: `${BRAND_GUIDELINES_PROMPT}\n\n## Website Content\n${state.crawledContent.slice(0, 5000)}\n\n## Extracted CSS Data\nColors found: ${state.extractedStyles.colors.join(", ")}\nFonts found: ${state.extractedStyles.fonts.join(", ")}\n\n## Site Metadata\nTitle: ${state.siteMetadata.title || "N/A"}\nDescription: ${state.siteMetadata.description || "N/A"}`,
    },
  ];

  if (state.screenshots.length > 0) {
    messageContent.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${state.screenshots[0]}` },
    });
  }

  const response = await llm.invoke([
    new HumanMessage({ content: messageContent }),
  ]);

  const brandGuidelines = typeof response.content === "string"
    ? response.content
    : "";

  state.emitEvent("message", {
    role: "agent",
    content: "Solid brand identity emerging. I've mapped out your colors, typography, and design language.",
  });

  state.emitEvent("file_card", {
    type: "brand_guidelines",
    title: "Brand Guidelines",
    content: brandGuidelines,
  });

  return { brandGuidelines };
}
```

- [ ] **Step 5: Create generate-profile node**

```typescript
// src/lib/agent/nodes/generate-profile.ts
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../state";
import { BUSINESS_PROFILE_PROMPT } from "../prompts/business-profile";
import { searchWeb } from "../tools/serper";

const llm = new ChatOpenAI({
  modelName: "google/gemini-2.5-pro-preview",
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  temperature: 0.3,
});

export async function generateProfile(state: AgentStateType): Promise<Partial<AgentStateType>> {
  state.emitEvent("status", {
    task: "generate_profile",
    message: "Building business profile",
  });

  const domain = new URL(state.websiteUrl).hostname;
  const pressResults = await searchWeb(`"${domain}" OR "${state.siteMetadata.title}" news coverage`, 5);
  const pressContext = pressResults
    .map((r) => `- ${r.title}: ${r.snippet}`)
    .join("\n");

  const response = await llm.invoke([
    new HumanMessage({
      content: `${BUSINESS_PROFILE_PROMPT}\n\n## Website Content\n${state.crawledContent.slice(0, 8000)}\n\n## Website URL\n${state.websiteUrl}\n\n## Press / External Mentions\n${pressContext || "No press coverage found"}\n\n## Site Metadata\nTitle: ${state.siteMetadata.title || "N/A"}\nDescription: ${state.siteMetadata.description || "N/A"}`,
    }),
  ]);

  const businessProfile = typeof response.content === "string"
    ? response.content
    : "";

  state.emitEvent("message", {
    role: "agent",
    content: `Great picture forming already. I've mapped out the product, traction, and key value props.`,
  });

  state.emitEvent("file_card", {
    type: "business_profile",
    title: "Business Profile",
    content: businessProfile,
  });

  return { businessProfile };
}
```

- [ ] **Step 6: Create research-market node**

```typescript
// src/lib/agent/nodes/research-market.ts
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../state";
import { MARKET_RESEARCH_PROMPT } from "../prompts/market-research";
import { searchMultiple } from "../tools/serper";

const llm = new ChatOpenAI({
  modelName: "google/gemini-2.5-pro-preview",
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  temperature: 0.4,
});

export async function researchMarket(state: AgentStateType): Promise<Partial<AgentStateType>> {
  state.emitEvent("status", {
    task: "research_market",
    message: "Searching the web",
  });

  const domain = new URL(state.websiteUrl).hostname;
  const companyName = state.siteMetadata.title?.split(/[|\-–]/)[0]?.trim() || domain;

  const queries = [
    `${companyName} industry market size 2025 2026`,
    `${companyName} competitors alternatives`,
    `"${domain}" reviews OR customers OR users`,
    `${companyName} industry trends growth`,
  ];

  const searchResults = await searchMultiple(queries);

  state.emitEvent("status", {
    task: "research_market",
    message: "Researching keywords",
  });

  const keywordQueries = [
    `${companyName} type of product keyword search volume`,
  ];
  const keywordResults = await searchMultiple(keywordQueries);

  const allResults = { ...searchResults, ...keywordResults };
  const searchContext = Object.entries(allResults)
    .map(([query, results]) => {
      const formatted = results
        .slice(0, 5)
        .map((r) => `  - ${r.title}: ${r.snippet}`)
        .join("\n");
      return `### Query: "${query}"\n${formatted}`;
    })
    .join("\n\n");

  const response = await llm.invoke([
    new HumanMessage({
      content: `${MARKET_RESEARCH_PROMPT}\n\n## Company Website Content\n${state.crawledContent.slice(0, 4000)}\n\n## Company URL\n${state.websiteUrl}\n\n## Web Search Results\n${searchContext}`,
    }),
  ]);

  const marketResearch = typeof response.content === "string"
    ? response.content
    : "";

  state.emitEvent("message", {
    role: "agent",
    content: `Big market signals found. I've mapped the competitive landscape, keyword opportunity, and target segments.`,
  });

  state.emitEvent("file_card", {
    type: "market_research",
    title: "Market Research",
    content: marketResearch,
  });

  return { marketResearch };
}
```

- [ ] **Step 7: Create generate-strategy node**

```typescript
// src/lib/agent/nodes/generate-strategy.ts
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import type { AgentStateType } from "../state";
import { MARKETING_STRATEGY_PROMPT } from "../prompts/marketing-strategy";

const llm = new ChatOpenAI({
  modelName: "google/gemini-2.5-pro-preview",
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  temperature: 0.6,
});

export async function generateStrategy(state: AgentStateType): Promise<Partial<AgentStateType>> {
  state.emitEvent("status", {
    task: "generate_strategy",
    message: "Crafting marketing strategy",
  });

  const selectedServicesText = state.selectedServices.join(", ");

  const response = await llm.invoke([
    new HumanMessage({
      content: `${MARKETING_STRATEGY_PROMPT}\n\n## Selected Marketing Services\nThe client wants help with: ${selectedServicesText}\nFocus your strategy primarily on these channels.\n\n## Business Profile\n${state.businessProfile.slice(0, 3000)}\n\n## Brand Guidelines\n${state.brandGuidelines.slice(0, 2000)}\n\n## Market Research\n${state.marketResearch.slice(0, 4000)}\n\n## Website URL\n${state.websiteUrl}`,
    }),
  ]);

  const marketingStrategy = typeof response.content === "string"
    ? response.content
    : "";

  state.emitEvent("message", {
    role: "agent",
    content: `Strategy locked in. I've tailored recommendations to your market position and competitive landscape. Let me pull everything together into the final files.`,
  });

  state.emitEvent("file_card", {
    type: "marketing_strategy",
    title: "Marketing Strategy",
    content: marketingStrategy,
  });

  return { marketingStrategy };
}
```

- [ ] **Step 8: Create synthesize node**

```typescript
// src/lib/agent/nodes/synthesize.ts
import type { AgentStateType } from "../state";

export async function synthesize(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const domain = new URL(state.websiteUrl).hostname.replace("www.", "");
  const companyName = state.siteMetadata?.title?.split(/[|\-–]/)[0]?.trim()
    || domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1);

  state.emitEvent("message", {
    role: "agent",
    content: `All done! I've completed the full brand DNA analysis for ${companyName}. Here's what I've built for you:\n\n- **Business Profile** — product overview, traction, pricing, and value props\n- **Brand Guidelines** — colors, typography, tone, and UI patterns\n- **Market Research** — market sizing, competitors, keywords, and audience pain points\n- **Marketing Strategy** — channel strategies, content pillars, and 30-day quick wins\n\nYou can find all four files in your Brand Knowledge Base. Let me know if you'd like me to dig deeper into anything.`,
  });

  state.emitEvent("complete", {
    status: "completed",
    filesGenerated: 4,
  });

  return {};
}
```

- [ ] **Step 9: Create the LangGraph definition**

```typescript
// src/lib/agent/graph.ts
import { StateGraph } from "@langchain/langgraph";
import { AgentState } from "./state";
import { planTasks } from "./nodes/plan-tasks";
import { crawlWebsite } from "./nodes/crawl-website";
import { extractBrand } from "./nodes/extract-brand";
import { generateProfile } from "./nodes/generate-profile";
import { researchMarket } from "./nodes/research-market";
import { generateStrategy } from "./nodes/generate-strategy";
import { synthesize } from "./nodes/synthesize";

export function createBrandDNAGraph() {
  const graph = new StateGraph(AgentState)
    .addNode("plan_tasks", planTasks)
    .addNode("crawl_website", crawlWebsite)
    .addNode("extract_brand", extractBrand)
    .addNode("generate_profile", generateProfile)
    .addNode("research_market", researchMarket)
    .addNode("generate_strategy", generateStrategy)
    .addNode("synthesize", synthesize)
    .addEdge("__start__", "plan_tasks")
    .addEdge("plan_tasks", "crawl_website")
    .addEdge("crawl_website", "extract_brand")
    .addEdge("crawl_website", "generate_profile")
    .addEdge("crawl_website", "research_market")
    .addEdge("extract_brand", "synthesize")
    .addEdge("generate_profile", "synthesize")
    .addEdge("research_market", "generate_strategy")
    .addEdge("generate_strategy", "synthesize");

  return graph.compile();
}
```

Note: LangGraph handles the parallel fan-out from `crawl_website` to `extract_brand`, `generate_profile`, and `research_market` automatically since they all have edges from the same source. The `synthesize` node waits for all its incoming edges to complete before running.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add LangGraph brand DNA agent with all nodes"
```

---

## Task 10: API Routes (Agent Start + SSE Stream)

**Files:**
- Create: `src/app/api/agent/start/route.ts`, `src/app/api/agent/stream/[runId]/route.ts`, `src/app/api/brand-files/[orgId]/route.ts`

- [ ] **Step 1: Create agent start route**

```typescript
// src/app/api/agent/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, agentRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createBrandDNAGraph } from "@/lib/agent/graph";
import { brandFiles, chatMessages } from "@/lib/db/schema";

// In-memory store for SSE connections (per agent run)
const runEventEmitters = new Map<string, Array<(event: string, data: Record<string, unknown>) => void>>();

export function getEventEmitters(runId: string) {
  return runEventEmitters.get(runId) || [];
}

export function registerListener(runId: string, listener: (event: string, data: Record<string, unknown>) => void) {
  if (!runEventEmitters.has(runId)) {
    runEventEmitters.set(runId, []);
  }
  runEventEmitters.get(runId)!.push(listener);

  return () => {
    const listeners = runEventEmitters.get(runId);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx > -1) listeners.splice(idx, 1);
      if (listeners.length === 0) runEventEmitters.delete(runId);
    }
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { organizationId, websiteUrl, selectedServices } = body;

  // Update organization with onboarding data
  const [org] = await db
    .update(organizations)
    .set({
      websiteUrl,
      selectedServices,
      onboardingCompleted: true,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning();

  // Create agent run
  const [run] = await db
    .insert(agentRuns)
    .values({
      organizationId,
      status: "running",
      startedAt: new Date(),
      tasks: {
        plan_tasks: "pending",
        crawl_website: "pending",
        extract_brand: "pending",
        generate_profile: "pending",
        research_market: "pending",
        generate_strategy: "pending",
        synthesize: "pending",
      },
    })
    .returning();

  // Run the agent in the background
  const graph = createBrandDNAGraph();

  const emitEvent = (event: string, data: Record<string, unknown>) => {
    const listeners = getEventEmitters(run.id);
    listeners.forEach((listener) => listener(event, data));

    // Persist chat messages to DB
    if (event === "message" || event === "status") {
      db.insert(chatMessages)
        .values({
          organizationId,
          role: (data.role as string) || "system",
          content: (data.content as string) || (data.message as string) || "",
          type: event === "status" ? "status" : "text",
        })
        .catch(console.error);
    }

    if (event === "file_card") {
      db.insert(brandFiles)
        .values({
          organizationId,
          type: data.type as string,
          title: data.title as string,
          content: data.content as string,
          metadata: {},
        })
        .returning()
        .then(([file]) => {
          db.insert(chatMessages)
            .values({
              organizationId,
              role: "agent",
              content: data.title as string,
              type: "file_card",
              fileId: file.id,
            })
            .catch(console.error);
        })
        .catch(console.error);
    }
  };

  // Fire and forget — the SSE stream will pick up events
  graph
    .invoke({
      websiteUrl,
      selectedServices,
      organizationId,
      emitEvent,
    })
    .then(() => {
      db.update(agentRuns)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(agentRuns.id, run.id))
        .catch(console.error);

      // Update logo URL if found
      emitEvent("complete", { status: "completed", filesGenerated: 4 });
    })
    .catch((error) => {
      console.error("Agent run failed:", error);
      db.update(agentRuns)
        .set({ status: "failed" })
        .where(eq(agentRuns.id, run.id))
        .catch(console.error);
      emitEvent("error", { message: "Analysis failed. Please try again." });
    });

  return NextResponse.json({
    runId: run.id,
    orgSlug: org.slug,
  });
}
```

- [ ] **Step 2: Create SSE stream route**

```typescript
// src/app/api/agent/stream/[runId]/route.ts
import { NextRequest } from "next/server";
import { registerListener } from "../../start/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: Record<string, unknown>) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));

        if (event === "complete" || event === "error") {
          controller.close();
        }
      }

      const unregister = registerListener(runId, send);

      // Clean up on abort
      _req.signal.addEventListener("abort", () => {
        unregister();
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Create brand files route**

```typescript
// src/app/api/brand-files/[orgId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { brandFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const files = await db
    .select()
    .from(brandFiles)
    .where(eq(brandFiles.organizationId, orgId))
    .orderBy(brandFiles.createdAt);

  return NextResponse.json(files);
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add API routes for agent start, SSE stream, and brand files"
```

---

## Task 11: SSE Hook

**Files:**
- Create: `src/hooks/useSSE.ts`

- [ ] **Step 1: Create useSSE hook**

```typescript
// src/hooks/useSSE.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessageData, BrandFile } from "@/types";

interface UseSSEOptions {
  runId: string | null;
  onComplete?: () => void;
}

export function useSSE({ runId, onComplete }: UseSSEOptions) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [files, setFiles] = useState<BrandFile[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const addMessage = useCallback((msg: Omit<ChatMessageData, "id" | "createdAt">) => {
    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      } as ChatMessageData,
    ]);
  }, []);

  useEffect(() => {
    if (!runId) return;

    setIsRunning(true);
    const es = new EventSource(`/api/agent/stream/${runId}`);
    eventSourceRef.current = es;

    es.addEventListener("message", (e) => {
      const data = JSON.parse(e.data);
      addMessage({
        role: data.role || "agent",
        content: data.content,
        type: "text",
      });
    });

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.message);
    });

    es.addEventListener("file_card", (e) => {
      const data = JSON.parse(e.data);
      const file: BrandFile = {
        id: data.fileId || crypto.randomUUID(),
        type: data.type,
        title: data.title,
        content: data.content,
        metadata: null,
        createdAt: new Date().toISOString(),
      };
      setFiles((prev) => [...prev, file]);
      addMessage({
        role: "agent",
        content: data.title,
        type: "file_card",
        fileId: file.id,
        file,
      });
    });

    es.addEventListener("complete", () => {
      setIsRunning(false);
      setStatus(null);
      onComplete?.();
      es.close();
    });

    es.addEventListener("error", (e) => {
      setIsRunning(false);
      setStatus(null);
      if (e instanceof MessageEvent) {
        const data = JSON.parse(e.data);
        addMessage({ role: "system", content: data.message, type: "text" });
      }
      es.close();
    });

    return () => {
      es.close();
    };
  }, [runId, addMessage, onComplete]);

  return { messages, files, status, isRunning };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add useSSE hook for real-time agent streaming"
```

---

## Task 12: Chat UI Components

**Files:**
- Create: `src/components/chat/ChatLayout.tsx`, `src/components/chat/ChatSidebar.tsx`, `src/components/chat/ChatMessages.tsx`, `src/components/chat/ChatMessage.tsx`, `src/components/chat/FileCard.tsx`, `src/components/chat/StatusIndicator.tsx`, `src/components/chat/KnowledgePanel.tsx`, `src/components/chat/ChatInput.tsx`

- [ ] **Step 1: Create StatusIndicator component**

```tsx
// src/components/chat/StatusIndicator.tsx
"use client";

interface StatusIndicatorProps {
  message: string;
}

export default function StatusIndicator({ message }: StatusIndicatorProps) {
  return (
    <div className="flex items-center gap-2 py-2 px-4">
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:0.2s]" />
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse [animation-delay:0.4s]" />
      </div>
      <span className="text-xs text-muted-dark">{message}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create FileCard component**

```tsx
// src/components/chat/FileCard.tsx
"use client";

import { useState } from "react";
import type { BrandFile } from "@/types";

interface FileCardProps {
  file: BrandFile;
}

export default function FileCard({ file }: FileCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const fileIcon = {
    business_profile: "\uD83D\uDCC4",
    brand_guidelines: "\uD83D\uDCC4",
    market_research: "\uD83D\uDCC4",
    marketing_strategy: "\uD83D\uDCC4",
  }[file.type];

  const displayTitle = {
    business_profile: "business-profile.md",
    brand_guidelines: "brand-guidelines.md",
    market_research: "market-research.md",
    marketing_strategy: "marketing-strategy.md",
  }[file.type];

  async function handleCopy() {
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="my-3 rounded-xl border border-border bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#fafafa] border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm">{fileIcon}</span>
          <span className="text-sm font-medium text-dark">{displayTitle}</span>
          <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            File
          </span>
          <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            Saved
          </span>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 py-4 max-h-96 overflow-y-auto">
          <div
            className="prose prose-sm max-w-none prose-headings:text-dark prose-p:text-muted-dark prose-strong:text-dark prose-table:text-sm"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(file.content) }}
          />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-muted-dark hover:text-dark transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "" : "rotate-180"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          {isExpanded ? "Collapse" : "Expand"}
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-muted-dark hover:text-dark transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// Simple markdown to HTML converter for display
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
    .replace(
      /\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)*)/g,
      (_match, header, body) => {
        const headers = header.split("|").filter(Boolean).map((h: string) => `<th>${h.trim()}</th>`).join("");
        const rows = body
          .trim()
          .split("\n")
          .map((row: string) => {
            const cells = row.split("|").filter(Boolean).map((c: string) => `<td>${c.trim()}</td>`).join("");
            return `<tr>${cells}</tr>`;
          })
          .join("");
        return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
      }
    )
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hultop])(.+)$/gm, "<p>$1</p>");
}
```

- [ ] **Step 3: Create ChatMessage component**

```tsx
// src/components/chat/ChatMessage.tsx
"use client";

import type { ChatMessageData } from "@/types";
import FileCard from "./FileCard";

interface ChatMessageProps {
  message: ChatMessageData;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  if (message.type === "file_card" && message.file) {
    return <FileCard file={message.file} />;
  }

  return (
    <div className="flex gap-3 py-3">
      {message.role === "agent" && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">🤖</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        {message.role === "agent" && (
          <p className="text-xs font-semibold text-dark mb-1">Helena</p>
        )}
        <p className="text-sm text-muted-dark leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ChatMessages component**

```tsx
// src/components/chat/ChatMessages.tsx
"use client";

import { useEffect, useRef } from "react";
import type { ChatMessageData } from "@/types";
import ChatMessage from "./ChatMessage";
import StatusIndicator from "./StatusIndicator";

interface ChatMessagesProps {
  messages: ChatMessageData[];
  status: string | null;
}

export default function ChatMessages({ messages, status }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {/* Agent header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-lg">🤖</span>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-dark">Helena</h2>
          <p className="text-xs text-muted">AI Digital Marketer</p>
        </div>
      </div>

      {/* Messages */}
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}

      {/* Active status */}
      {status && <StatusIndicator message={status} />}

      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 5: Create ChatSidebar component**

```tsx
// src/components/chat/ChatSidebar.tsx
"use client";

interface ChatSidebarProps {
  orgName: string;
  logoUrl: string | null;
}

export default function ChatSidebar({ orgName, logoUrl }: ChatSidebarProps) {
  return (
    <div className="w-60 border-r border-border bg-white flex flex-col">
      {/* Org header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={orgName} className="w-7 h-7 rounded" />
          ) : (
            <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {orgName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-dark truncate">{orgName}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
        <p className="text-[10px] uppercase font-semibold text-muted tracking-wider mb-2 px-2">
          Channels
        </p>
        <a
          href="#"
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-dark bg-light font-medium"
        >
          <span className="text-muted-dark">#</span> main
        </a>

        <p className="text-[10px] uppercase font-semibold text-muted tracking-wider mt-6 mb-2 px-2">
          Direct Messages
        </p>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-dark">
          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-[10px]">🤖</span>
          </div>
          <span>Helena</span>
          <span className="text-[10px] text-primary ml-auto">AI Digital Marketer</span>
        </div>
      </nav>

      {/* User */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-6 h-6 rounded-full bg-muted/20" />
          <span className="text-xs text-muted-dark truncate">Your Profile</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create KnowledgePanel component**

```tsx
// src/components/chat/KnowledgePanel.tsx
"use client";

import type { BrandFile } from "@/types";

interface KnowledgePanelProps {
  files: BrandFile[];
  logoUrl: string | null;
}

const FILE_LABELS: Record<string, string> = {
  business_profile: "business profile",
  brand_guidelines: "brand guidelines",
  market_research: "market research",
  marketing_strategy: "marketing strategy",
};

export default function KnowledgePanel({ files, logoUrl }: KnowledgePanelProps) {
  return (
    <div className="w-72 border-l border-border bg-white overflow-y-auto">
      {/* Metrics placeholder */}
      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-semibold text-dark uppercase tracking-wider mb-3">
          Metrics
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-muted uppercase">Active Users</p>
            <p className="text-xs text-muted-dark">Connect GA</p>
          </div>
          <div>
            <p className="text-[10px] text-muted uppercase">Sessions</p>
            <p className="text-xs text-muted-dark">Connect GA</p>
          </div>
        </div>
      </div>

      {/* Channels placeholder */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-dark uppercase tracking-wider">
            Channels
          </h3>
          <span className="text-[10px] text-muted-dark">Autopilot</span>
        </div>
        <button className="text-xs text-primary hover:underline">
          + Add channel
        </button>
      </div>

      {/* Brand Knowledge Base */}
      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-semibold text-dark uppercase tracking-wider mb-3">
          Brand Knowledge Base
        </h3>
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-light cursor-pointer transition-colors"
            >
              <span className="text-sm">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-dark truncate">
                  {FILE_LABELS[file.type] || file.title}
                </p>
                <p className="text-[10px] text-muted">
                  {new Date(file.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
              </div>
              <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))}
          {files.length > 2 && (
            <button className="text-xs text-muted-dark hover:text-dark">
              View all ({files.length}) →
            </button>
          )}
        </div>
      </div>

      {/* Brand Assets */}
      <div className="p-4">
        <h3 className="text-xs font-semibold text-dark uppercase tracking-wider mb-3">
          Brand Assets
        </h3>
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-light cursor-pointer transition-colors">
          {logoUrl ? (
            <img src={logoUrl} alt="Company Logo" className="w-10 h-10 rounded object-contain bg-light p-1" />
          ) : (
            <div className="w-10 h-10 rounded bg-light flex items-center justify-center text-muted text-xs">
              Logo
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-dark">Company Logo</p>
            <p className="text-[10px] text-primary">Click to replace</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create ChatInput component**

```tsx
// src/components/chat/ChatInput.tsx
"use client";

interface ChatInputProps {
  disabled: boolean;
  agentName?: string;
}

export default function ChatInput({ disabled, agentName = "Helena" }: ChatInputProps) {
  return (
    <div className="border-t border-border p-4">
      <div className="flex items-center gap-2 bg-light rounded-xl px-4 py-3">
        <input
          type="text"
          placeholder={disabled ? `${agentName} is working...` : `Message ${agentName}...`}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-dark placeholder:text-muted outline-none disabled:cursor-not-allowed"
        />
        <button
          disabled={disabled}
          className="text-muted hover:text-primary transition-colors disabled:opacity-30"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create ChatLayout component**

```tsx
// src/components/chat/ChatLayout.tsx
"use client";

import { useSSE } from "@/hooks/useSSE";
import ChatSidebar from "./ChatSidebar";
import ChatMessages from "./ChatMessages";
import KnowledgePanel from "./KnowledgePanel";
import ChatInput from "./ChatInput";

interface ChatLayoutProps {
  runId: string | null;
  orgName: string;
  logoUrl: string | null;
}

export default function ChatLayout({ runId, orgName, logoUrl }: ChatLayoutProps) {
  const { messages, files, status, isRunning } = useSSE({
    runId,
  });

  return (
    <div className="flex h-screen bg-[#fafafa]">
      <ChatSidebar orgName={orgName} logoUrl={logoUrl} />

      <div className="flex-1 flex flex-col">
        <ChatMessages messages={messages} status={status} />
        <ChatInput disabled={isRunning} />
      </div>

      <KnowledgePanel files={files} logoUrl={logoUrl} />
    </div>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add chat UI components with 3-panel layout"
```

---

## Task 13: App Layout + Chat Page + Middleware

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/[orgSlug]/chat/page.tsx`, `middleware.ts`

- [ ] **Step 1: Create app layout**

```tsx
// src/app/(app)/layout.tsx
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create chat page**

```tsx
// src/app/(app)/[orgSlug]/chat/page.tsx
import { db } from "@/lib/db";
import { organizations, agentRuns } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import ChatLayout from "@/components/chat/ChatLayout";

interface ChatPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ runId?: string }>;
}

export default async function ChatPage({ params, searchParams }: ChatPageProps) {
  const { orgSlug } = await params;
  const { runId: queryRunId } = await searchParams;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) notFound();

  // Get the latest agent run if no specific runId
  let runId = queryRunId || null;
  if (!runId) {
    const [latestRun] = await db
      .select()
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.organizationId, org.id),
          eq(agentRuns.status, "running")
        )
      )
      .orderBy(desc(agentRuns.startedAt))
      .limit(1);
    runId = latestRun?.id || null;
  }

  return (
    <ChatLayout
      runId={runId}
      orgName={org.name}
      logoUrl={org.logoUrl}
    />
  );
}
```

- [ ] **Step 3: Create middleware**

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protected app routes
  if (pathname.startsWith("/app")) {
    const sessionCookie = request.cookies.get("better-auth.session_token");
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding"],
};
```

- [ ] **Step 4: Update Navbar login/signup links**

In `src/components/marketing/Navbar.tsx`, find the login and "Get Started" links and update their `href` attributes:
- Login link: change `href="#"` to `href="/login"`
- Get Started button: change `href="#cta"` or `href="#"` to `href="/signup"`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add app layout, chat page, and auth middleware"
```

---

## Task 14: Add .gitignore entry and clean up

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore**

Add these lines to `.gitignore`:

```
.env.local
.env
.superpowers/
.next/
drizzle/meta/
```

- [ ] **Step 2: Delete old index.css if still present**

```bash
rm -f src/index.css
```

- [ ] **Step 3: Verify dev server starts cleanly**

```bash
npm run dev
```

Expected: Next.js dev server starts on http://localhost:3000 with no build errors. Landing page renders at `/`. Auth pages render at `/login` and `/signup`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean up migration artifacts, update gitignore"
```

---

## Task 15: Integration Testing — End-to-End Flow

- [ ] **Step 1: Start PostgreSQL**

Ensure PostgreSQL is running locally or update `DATABASE_URL` in `.env.local` to point to a Railway dev database.

- [ ] **Step 2: Push schema to database**

```bash
npx drizzle-kit push
```

Expected: All tables created (organizations, brand_files, chat_messages, agent_runs, plus BetterAuth tables).

- [ ] **Step 3: Start dev server**

```bash
npm run dev
```

- [ ] **Step 4: Test signup flow**

Navigate to http://localhost:3000/signup. Create an account. Verify redirect to `/onboarding`.

- [ ] **Step 5: Test onboarding wizard**

Step through the 3 onboarding steps:
1. Enter a website URL (e.g., `https://lawlyfy.ai`)
2. Verify services are pre-selected, toggle some
3. Skip platform connections, click "Start Analysis"

Verify redirect to `/app/[orgSlug]/chat` with the agent running.

- [ ] **Step 6: Test agent stream**

On the chat page, verify:
- Status indicators appear ("Working on getWebsiteContent", "Searching the web")
- Agent narration messages stream in
- File cards appear with collapsible markdown content
- 4 files generated (business profile, brand guidelines, market research, marketing strategy)
- "Saved" badges show on each file card

- [ ] **Step 7: Test file quality**

Expand each file card and verify:
- Business Profile has specific numbers, pricing tables, feature lists
- Brand Guidelines has exact hex codes, font names, color table
- Market Research has market size figures, competitor analysis, keyword table
- Marketing Strategy has channel strategies, ad copy examples, 30-day quick wins

- [ ] **Step 8: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes for end-to-end onboarding flow"
```
