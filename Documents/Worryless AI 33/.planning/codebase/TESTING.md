# Testing Patterns

**Analysis Date:** 2026-03-12

## Test Framework

**Runner:** None configured

No test framework is installed or configured in this project. The `package.json` at `worrylesssuperagent/package.json` contains no test dependencies (no Jest, Vitest, Playwright, Cypress, or Testing Library packages). There is no `jest.config.*`, `vitest.config.*`, or `playwright.config.*` file present.

**Run Commands:**
```bash
# No test commands available
# package.json scripts: dev, build, build:dev, lint, preview
```

## Test File Organization

**Location:** No test files exist in the codebase.

Running a search for `*.test.*` and `*.spec.*` files returns zero results across the entire project.

**Naming:** Not applicable — no test files present.

## Test Structure

**Suite Organization:** Not applicable.

## Mocking

**Framework:** Not applicable.

## Fixtures and Factories

**Test Data:** Not applicable.

## Coverage

**Requirements:** No coverage targets or tooling configured.

## Test Types

**Unit Tests:** None present.

**Integration Tests:** None present.

**E2E Tests:** None present.

## What This Means for New Code

Because there are no tests, adding any test infrastructure will require setup from scratch. Recommended approach if adding tests:

**Recommended stack (compatible with Vite + React):**
- `vitest` as the test runner (native Vite integration, no config overhead)
- `@testing-library/react` for component rendering
- `@testing-library/user-event` for user interaction simulation
- `jsdom` as the test environment

**Suggested config file location:** `worrylesssuperagent/vitest.config.ts`

**Suggested test file placement:** Co-locate test files next to source files:
```
src/
  components/
    chat/
      ChatInterface.tsx
      ChatInterface.test.tsx   ← place here
  hooks/
    use-toast.ts
    use-toast.test.ts          ← place here
  lib/
    utils.ts
    utils.test.ts              ← place here
```

**Highest-value areas to test first** (pure logic with no UI dependencies):
- `src/lib/utils.ts` — `cn()` helper
- `src/hooks/use-toast.ts` — `reducer()` is exported and fully pure
- `src/hooks/useScrollAnimation.tsx` — IntersectionObserver hook logic
- `src/components/agents/AccountantAgent.tsx` — `extractAvailableDateRanges()` and `extractDatasheetMetrics()` are pure functions embedded in the component; candidates for extraction and testing

**Example test pattern for the exported reducer in `src/hooks/use-toast.ts`:**
```typescript
import { describe, it, expect } from "vitest";
import { reducer } from "@/hooks/use-toast";

describe("toast reducer", () => {
  it("adds a toast on ADD_TOAST", () => {
    const state = { toasts: [] };
    const next = reducer(state, {
      type: "ADD_TOAST",
      toast: { id: "1", title: "Hello", open: true, onOpenChange: () => {} },
    });
    expect(next.toasts).toHaveLength(1);
    expect(next.toasts[0].title).toBe("Hello");
  });

  it("removes a toast on REMOVE_TOAST", () => {
    const state = { toasts: [{ id: "1", open: false, onOpenChange: () => {} }] };
    const next = reducer(state, { type: "REMOVE_TOAST", toastId: "1" });
    expect(next.toasts).toHaveLength(0);
  });
});
```

**Mocking Supabase in component tests:**
```typescript
import { vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-id" } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));
```

---

*Testing analysis: 2026-03-12*
