# Coding Conventions

**Analysis Date:** 2026-03-12

## Naming Patterns

**Files:**
- React component files use PascalCase: `DashboardOverview.tsx`, `AccountantAgent.tsx`, `ConversationalOnboarding.tsx`
- Hook files use camelCase with `use-` prefix (kebab for filename): `use-toast.ts`, `use-mobile.tsx`, `useScrollAnimation.tsx` (inconsistency — some use camelCase, some kebab-case)
- Page files use PascalCase: `Dashboard.tsx`, `Auth.tsx`, `Index.tsx`, `NotFound.tsx`
- Utility files use camelCase: `utils.ts`, `client.ts`, `types.ts`
- Supabase edge functions use kebab-case directory names: `chat-with-agent/`, `generate-outreach/`, `parse-datasheet/`

**Functions/Handlers:**
- Event handlers prefixed with `handle`: `handleSignUp`, `handleSignIn`, `handleSend`, `handleFileSelect`, `handleAddInvoice`, `handleDeleteDatasheet`
- Async data-fetching functions named `fetchData` or `fetchStats`
- Helper/utility functions use camelCase: `getAgentIcon`, `getAgentName`, `formatFileSize`, `getStatusColor`, `extractAvailableDateRanges`

**Variables:**
- State variables use camelCase with descriptive names: `isLoading`, `dialogOpen`, `activeView`, `checkingOnboarding`
- Boolean state often prefixed with `is`, `show`, `checking`: `isLoading`, `showOnboarding`, `checkingOnboarding`, `uploading`
- Constants use SCREAMING_SNAKE_CASE for module-level values: `MAX_FILE_SIZE`, `ALLOWED_TYPES`, `MOBILE_BREAKPOINT`, `LOVABLE_AI_GATEWAY`, `DEFAULT_MODEL`

**Types and Interfaces:**
- `type` aliases use PascalCase for local types: `Message`, `Attachment`, `Invoice`, `Transaction`, `Datasheet`, `Step`, `ActiveView`
- Interfaces use PascalCase with descriptive names: `ConversationalOnboardingProps`, `DashboardOverviewProps`, `ImpactMetrics`
- Discriminated union types for step machines: `type Step = "welcome" | "business_name" | ...`
- Props interfaces always named `[ComponentName]Props`

**Components:**
- Named exports using `export function ComponentName()` pattern for feature components: `export function ChatInterface()`, `export function AccountantAgent()`
- Default exports for page-level components: `export default Dashboard`, `export default Auth`
- Arrow function style for simple/root-level: `const App = () => (...)` with `export default App`

## Code Style

**Formatting:**
- No Prettier config detected — formatting is likely handled by editor defaults or ESLint
- 2-space indentation (consistent throughout codebase)
- Trailing commas used in multi-line objects and arrays
- Template literals preferred over string concatenation

**Linting:**
- ESLint configured at `worrylesssuperagent/eslint.config.js`
- Extends `js.configs.recommended` and `tseslint.configs.recommended`
- Plugins: `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- `@typescript-eslint/no-unused-vars` is **disabled** (set to "off")
- React Hooks rules enforced via `reactHooks.configs.recommended.rules`
- TypeScript strict mode is **disabled** (`"strict": false` in `tsconfig.app.json`)
- `noImplicitAny` is **disabled** — types are often loosely applied

## Import Organization

**Order (observed pattern):**
1. React and React hooks: `import { useState, useEffect } from "react"`
2. Third-party routing/query: `import { useNavigate } from "react-router-dom"`
3. Internal Supabase client: `import { supabase } from "@/integrations/supabase/client"`
4. UI component library imports: `import { Card, CardContent } from "@/components/ui/card"`
5. Hook imports: `import { useToast } from "@/hooks/use-toast"`
6. Icon imports: `import { Send, Loader2 } from "lucide-react"`

**Path Aliases:**
- `@/*` maps to `./src/*` — use this for all internal imports
- Example: `import { supabase } from "@/integrations/supabase/client"`
- Do NOT use relative paths like `../../` for cross-directory imports

## Error Handling

**Frontend components:**
- Supabase errors destructured from response: `const { data, error } = await supabase...`
- Error responses shown via the `toast()` helper with `variant: "destructive"` and descriptive `title` + `description`:
  ```typescript
  toast({ title: "Error", description: error.message, variant: "destructive" });
  ```
- Catch blocks narrow the unknown error type explicitly:
  ```typescript
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    toast({ title: "Error", description: message, variant: "destructive" });
  }
  ```
- Some older catch blocks use `catch (error: any)` — avoid this; prefer `unknown`
- `console.error(...)` used consistently for catch blocks alongside toast notifications

**Edge functions (Deno):**
- All handlers wrapped in try/catch returning JSON error responses:
  ```typescript
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: corsHeaders });
  }
  ```
- HTTP status codes checked explicitly (429, 402, etc.) before generic error handling

**Loading states:**
- Loading boolean toggled with `setLoading(true)` before async operations, reset in `finally` block
- Separate loading states for distinct async operations: `loading`, `uploading`, `uploadingDatasheet`

## Logging

**Frontend:** `console.error(...)` used exclusively for error catch blocks — no general-purpose `console.log` in production code

**Edge functions:** `console.error(...)` for unexpected errors only, e.g. `console.error("AI Gateway error:", response.status, errorText)`

## Comments

**When to Comment:**
- Inline comments explain non-obvious business logic: `// 10MB`, `// Time savings calculation (in hours):`
- Block comments for TODO notes in library code: `// ! Side effects ! - This could be extracted...`
- Section dividers using JSX comments in large components: `{/* Summary Cards */}`
- Edge function configs explained via inline comments in system prompts

**JSDoc/TSDoc:** Not used — no JSDoc annotations present anywhere in the codebase

## Function Design

**Size:** Components tend to be large (100–800 lines). `AccountantAgent.tsx` is 813 lines. No enforced size limit.

**Parameters:**
- Component props destructured inline: `export function Component({ userId, userEmail, onComplete }: Props)`
- Callback props named `on[Event]`: `onComplete`, `onNavigate`, `onViewChange`, `onTaskCreated`

**Return Values:**
- Components always return JSX or `null`
- Helper functions return primitive values or objects — no Promises from pure helpers
- Async functions return `void` implicitly; errors surface via toast notifications

## Module Design

**Exports:**
- Feature components use named exports: `export function DashboardOverview(...)`
- Page components use default exports: `export default Dashboard`
- Hooks always use named exports: `export { useToast, toast }`, `export function useIsMobile()`
- Types exported inline: `export type ActiveView = ...`

**Barrel Files:** Not used — no `index.ts` barrel exports present; all imports reference full file paths

## Tailwind Usage

- All styling done via Tailwind utility classes directly in JSX — no CSS modules or styled-components
- `cn()` utility from `src/lib/utils.ts` used for conditional class merging:
  ```typescript
  import { cn } from "@/lib/utils";
  className={cn("base-classes", conditionalClass && "extra-class")}
  ```
- Design tokens via CSS variables: `text-foreground`, `bg-background`, `text-muted-foreground`, `text-primary`, `border-border`
- Semantic color classes preferred over raw colors: `text-destructive`, `bg-muted`, `text-accent`
- Raw color shades used for agent-specific branding: `text-emerald-500`, `text-violet-500`, `text-amber-500`, `text-sky-500`

## Supabase Pattern

**All Supabase calls follow this pattern:**
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) return;

const { data, error } = await supabase
  .from("table_name")
  .select("*")
  .eq("user_id", user.id);

if (error) {
  toast({ title: "Error", description: error.message, variant: "destructive" });
} else {
  // use data
}
```

**Edge functions** use Deno imports from CDN: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"`

---

*Convention analysis: 2026-03-12*
