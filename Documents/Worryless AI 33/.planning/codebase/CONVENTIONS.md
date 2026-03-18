# Coding Conventions

**Analysis Date:** 2026-03-18

## Naming Patterns

**Files:**
- React components: PascalCase + `.tsx` (e.g., `SettingsPage.tsx`, `AccountantAgent.tsx`)
- Hooks: camelCase with `use` prefix + `.ts` (e.g., `useHeartbeatConfig.ts`, `useTeamData.ts`)
- Utilities: camelCase + `.ts` (e.g., `heartbeatUtils.ts`, `sanitize.ts`)
- Tests: same name as source + `.test.ts` (co-located in `src/__tests__/`)
- UI components: kebab-case + `.tsx` (e.g., `alert-dialog.tsx`, `input-otp.tsx`)
- Configuration files: camelCase + extension (e.g., `vite.config.ts`)

**Functions:**
- Async operations: `fetch*` prefix (e.g., `fetchProfile()`, `fetchValidators()`)
- Handlers: `handle*` prefix (e.g., `handleSave()`, `handleSelfToggle()`)
- Resolvers/transformers: `resolve*`, `parse*`, `build*` (e.g., `resolveView()`, `parseSeverity()`, `buildWorkspacePrompt()`)
- Hooks: `use*` prefix (e.g., `useHeartbeatConfig()`, `useTeamData()`)
- Internal utilities: lowercase + verb prefix (e.g., `getLocalHour()`, `parseHour()`, `extractJson()`)
- Boolean getters: `is*` prefix (e.g., `isEditing`, `isLoading`, `isActive`)

**Variables:**
- State: camelCase (e.g., `config`, `isLoading`, `validatorForm`, `editingAgent`)
- Constants: UPPER_SNAKE_CASE for truly immutable values (e.g., `VALID_SEVERITIES`, `AGENT_TYPE_ID` in tests)
- React props: camelCase (e.g., `disabled`, `checked`, `onValueChange`)
- Type guards: prefix with `is` or suffix with `Type` (e.g., `heartbeat_enabled: boolean`)
- Event handlers: `on*` prefix (e.g., `onValueChange`, `onCheckedChange()`)

**Types:**
- Interfaces: PascalCase (e.g., `HeartbeatConfig`, `TeamAgent`, `Profile`, `Validator`)
- Type unions: descriptive PascalCase (e.g., `Severity`, `WorkspaceFileType`)
- Props interfaces: `[ComponentName]Props` (e.g., `ButtonProps`)
- Generics: single uppercase letters (T, K, V) or descriptive names (e.g., `Record<string, unknown>`)

## Code Style

**Formatting:**
- No explicit Prettier config; ESLint handles linting
- Indentation: 2 spaces (consistent throughout)
- Imports organized with path aliases (`@/`)
- Trailing commas in multi-line objects/arrays

**Linting:**
- ESLint 9.32.0 with TypeScript support (flat config format)
- Config file: `eslint.config.js`
- Extends: `@eslint/js.configs.recommended` + `typescript-eslint.configs.recommended`
- Plugins: `react-hooks`, `react-refresh`
- Key rules:
  - `"react-refresh/only-export-components"`: warn (allowConstantExport: true)
  - `"@typescript-eslint/no-unused-vars"`: off
  - React hooks: `reactHooks.configs.recommended.rules` applied

**TypeScript Configuration:**
- `strict: false` (permissive mode)
- `noImplicitAny: false`
- `noUnusedLocals: false` (warnings disabled)
- `noUnusedParameters: false` (warnings disabled)
- JSX: react-jsx transform (no React import needed)

## Import Organization

**Order:**
1. React and core libraries (`import { useState }`)
2. Third-party packages (`@hookform`, `@radix-ui`, `@supabase`, `@tanstack`)
3. Internal path aliases (`@/integrations`, `@/components`, `@/hooks`, `@/lib`)
4. Relative imports (avoid; prefer path aliases)

**Path Aliases:**
- `@/` → `./src/` (configured in `tsconfig.app.json`)
- Used consistently throughout codebase

**Barrel Exports:**
- UI component library: uses barrel exports (e.g., `@radix-ui` components)
- Internal utilities: each has its own file (no barrels)

## Error Handling

**Patterns:**
- Try/catch with fallback returns (e.g., `parseSeverity()` returns `{ severity: 'ok', finding: '' }` on failure)
- Null checks before async operations: `if (!user) return;`
- Undefined checks at function entry: `if (!userId) { setLoading(false); return; }`
- Console error logging: `console.error('context:', error)` for async failures
- Toast notifications via `useToast()` for user-facing errors with `variant: "destructive"`
- Supabase errors: `if (error) { ... }` pattern with error message extraction
- Cancellation tokens for async cleanup: `let cancelled = false` with `return () => { cancelled = true; }`

**Silent Failures:**
- Feature unavailability: `console.warn()` instead of throwing
- Non-critical async failures: logged but UI continues

## Logging

**Framework:** Native `console` object

**Patterns:**
- `console.error()`: actual errors in async operations (fetch failures, parse errors)
- `console.warn()`: non-blocking issues (feature unavailable, fallbacks taken)
- Context provided: `console.error('[hookName] context:', error)`
- Never log sensitive data

**When to Log:**
- Async errors with operation context
- Feature unavailability (e.g., PushManager not available)
- Only error and warning levels used (no debug logs)

## Comments

**When to Comment:**
- Complex algorithms with explanation of intent (e.g., timezone logic)
- Sync contracts between duplicate files (e.g., `sanitize.ts` SYNC CONTRACT)
- TODO items link to planning phases (e.g., "// TODO: regenerate types after Phase 1")
- Edge cases documented inline (e.g., "Intl returns "24" for midnight; normalize to 0")

**JSDoc/TSDoc:**
- Comprehensive on pure utility functions (e.g., `heartbeatUtils.ts`)
- Parameters: `@param` tags with descriptions
- Returns: `@returns` tags with type info
- Sync instructions in JSDoc comments where needed
- React components: types are self-documenting via TypeScript

**Inline Comments:**
- Explain "why" not "what"
- State management patterns documented
- Edge cases and workarounds clearly noted

## Function Design

**Size:**
- Utility functions: 10-40 lines
- Hooks: 30-100 lines depending on complexity
- Components with JSX: can exceed 100 lines but kept under 400

**Parameters:**
- Most functions: 2-4 parameters; if more, use object parameter
- Hooks return objects: `{ config, isLoading, isSaving, updateConfig }`
- Callbacks have clear naming (e.g., `updateConfig: (patch: Partial<HeartbeatConfig>) => Promise<void>`)

**Return Values:**
- Async operations: `Promise<T>` or `Promise<void>`
- Hooks: object with state + methods: `{ data, loading, error, refetch }`
- Parsers: typed objects `{ severity: Severity; finding: string }`
- Boolean checks: exact `boolean` type (not truthy)

**Early Returns:**
- Used extensively for guard clauses: `if (!user) return;`
- Prevents deep nesting
- Main path is happy path

## Module Design

**Exports:**
- Named exports for most functions/types
- Default export for single-export React components
- UI components: both component and variants exported as named exports

**Barrel Files:**
- UI components: barrel exports in `components/ui/`
- Custom hooks: one hook per file (no barrel)
- Lib utilities: one utility per file (no barrel)

**File Organization:**
- One primary export per file
- Related pure functions grouped: `extractJson()` and `parseSeverity()` in `heartbeatParser.ts`
- Each hook: own file with clear responsibility

## Type Safety

**Patterns:**
- `Record<string, unknown>` for untyped Supabase data
- Type assertions with `as` when necessary (e.g., `row.agent_type_id as string`)
- Discriminated unions: `Severity = 'ok' | 'urgent' | 'headsup' | 'digest'`
- Optional chaining: `?.` widely used
- Nullish coalescing: `??` for fallback defaults

## Supabase Pattern

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) return;

const { data } = await (supabase as any)
  .from('table_name')
  .select('...')
  .eq('user_id', user.id);

if (error) {
  toast({ title: "Error", description: error.message, variant: "destructive" });
}
```

---

*Convention analysis: 2026-03-18*
