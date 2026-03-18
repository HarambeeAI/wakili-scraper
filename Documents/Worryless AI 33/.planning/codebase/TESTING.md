# Testing Patterns

**Analysis Date:** 2026-03-18

## Test Framework

**Runner:**
- Vitest 4.1.0
- Config: `vitest.config.ts`

**Assertion Library:**
- Native Vitest assertions via `expect()`

**Mocking:**
- `vi` from Vitest for mocks and spies
- `@testing-library/react` for hook testing
- `jsdom` as test environment

**Run Commands:**
```bash
npx vitest run           # Run tests once
npx vitest watch        # Run tests in watch mode
npx vitest run --coverage  # Run with coverage
```

## Test File Organization

**Location:**
- Centralized in `src/__tests__/` directory (not co-located)
- Flat structure (not mirrored with source)
- Excluded from TypeScript compilation via `tsconfig.app.json`

**Naming:**
- Pattern: `[subject].test.ts` (e.g., `useHeartbeatConfig.test.ts`, `heartbeatParser.test.ts`)

**Structure:**
```
src/__tests__/
├── buildWorkspacePrompt.test.ts
├── heartbeatParser.test.ts
├── heartbeatDispatcher.test.ts
├── sanitize.test.ts
├── useHeartbeatConfig.test.ts
├── useNotifications.test.ts
├── usePushSubscription.test.ts
├── useTeamData.test.ts
└── useWorkspaceAutoSave.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('functionName', () => {
  describe('feature/aspect', () => {
    it('returns X when Y', () => {
      expect(result).toBe(expected);
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });
});
```

**Patterns:**
- Top-level `describe()` for function/hook/component
- Secondary `describe()` for logical groupings (e.g., "read", "updateConfig", "edge cases")
- Individual `it()` specs for single behavior
- Clear spec descriptions: "returns X when Y", "validates Z on submit"
- `beforeEach()` for isolation
- No explicit teardown (Vitest cleans up)

## Mocking

**Framework:** Vitest `vi` module

**Patterns:**
```typescript
// Mock entire module
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
    },
  },
}));

// Create spy function
const mockGetUser = vi.fn(() =>
  Promise.resolve({ data: { user: { id: "user-abc" } } })
);

// Chain mocks for fluent APIs (Supabase style)
const mockSingle = vi.fn(() =>
  Promise.resolve({
    data: { heartbeat_enabled: true },
    error: null,
  })
);

const mockEqInner = vi.fn(() => ({ single: mockSingle }));
const mockEqOuter = vi.fn(() => ({ eq: mockEqInner }));
const mockSelect = vi.fn(() => ({ eq: mockEqOuter }));
```

**Chained Query Mocking:**
- Each level returns object with next method in chain
- Final method returns `Promise<{ data, error }>`
- Example chain: `from()` → `{ select }` → `{ eq }` → `{ eq }` → `{ single }` → Promise

**What to Mock:**
- External API clients (Supabase entirely)
- Service workers (PushManager when unavailable)
- Browser APIs not in jsdom
- Network requests via mocked promises

**What NOT to Mock:**
- Pure utility functions (parse, build, sanitize)
- React hooks from libraries (use `renderHook`)
- Native JavaScript methods (unless testing error paths)
- Custom hooks that wrap mocked APIs

**Module Import Timing:**
- Import tested function/hook AFTER mocks are set up
- Use dynamic `await import()` after mocks
- Example: `const { useHeartbeatConfig } = await import("@/hooks/useHeartbeatConfig");`

## Fixtures and Factories

**Test Data:**
```typescript
// Constants
const AGENT_TYPE_ID = "chief-of-staff";
const USER_ID = "user-abc";

// Reusable mock responses
const sampleFiles: Record<WorkspaceFileType, string> = {
  IDENTITY: 'identity content',
  SOUL: 'soul content',
  SOPs: 'sops content',
  MEMORY: 'memory content',
  HEARTBEAT: 'heartbeat content',
  TOOLS: 'tools content',
};

// Mock data objects
const mockChannel: Record<string, unknown> = {};
mockChannel.on = mockOn;
mockChannel.subscribe = mockSubscribe;
```

**Location:**
- Defined inline in test files (no separate fixtures directory)
- Reused across test cases in same file
- Kept close to usage for clarity

## Coverage

**Requirements:** Not explicitly enforced

**View Coverage:**
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- Scope: Pure utility functions, parsers, transformers
- Approach: Test with various inputs including edge cases
- Example: `heartbeatParser.test.ts` tests JSON extraction and severity parsing with 7+ cases
- Example: `sanitize.test.ts` tests all 12 injection patterns individually

**Hook Tests:**
- Scope: React hooks with async state management
- Approach: Use `renderHook()` from testing-library with `act()` for state updates
- Async handling: Flush microtasks with `await Promise.resolve()` twice
- Mock external dependencies (Supabase)
- Test both reading and updating data
- Example: `useHeartbeatConfig.test.ts` tests loading, reading config, and updating with pending state

**Realtime Subscription Tests:**
- Scope: Hooks that subscribe to Supabase channels
- Approach: Mock channel callbacks, verify `.on()` and `.subscribe()` called
- Cleanup verification: `removeChannel()` called in effect cleanup
- Optimistic update testing: state changes before async completes
- Example: `useNotifications.test.ts` tests notification loading, marking read, and unread count

## Common Patterns

**Async Testing:**
```typescript
it("loads data asynchronously", async () => {
  const { result } = renderHook(() => useHeartbeatConfig(AGENT_TYPE_ID));

  expect(result.current.isLoading).toBe(true);

  // Flush async operations
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(result.current.config).not.toBeNull();
  expect(result.current.isLoading).toBe(false);
});
```

**Hanging Promises (Testing Pending State):**
```typescript
// Make operation hang to test pending state
mockGetUser.mockReturnValue(new Promise(() => {}));

const { result } = renderHook(() => useHeartbeatConfig(AGENT_TYPE_ID));

// While hanging
expect(result.current.isLoading).toBe(true);
expect(result.current.config).toBeNull();
```

**Optimistic Updates:**
```typescript
it("decrements unreadCount immediately on markRead", async () => {
  const { result } = renderHook(() => useNotifications(USER_ID));

  // Load initial state
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  const countBefore = result.current.unreadCount;

  // Trigger action (no await - it's optimistic)
  await act(async () => {
    result.current.markRead("notif-1");
    await Promise.resolve();
  });

  // Verify optimistic update happened immediately
  expect(result.current.unreadCount).toBe(Math.max(0, countBefore - 1));
});
```

**Error Boundary / Fail-Safe Testing:**
```typescript
it('defaults to "ok" on malformed JSON (fail-safe)', () => {
  const result = parseSeverity('not valid json');
  expect(result).toEqual({ severity: 'ok', finding: '' });
});

it('defaults to "ok" when severity field is missing', () => {
  const result = parseSeverity('{"finding":"something"}');
  expect(result).toEqual({ severity: 'ok', finding: '' });
});
```

**Setup and Teardown:**
```typescript
describe('useHeartbeatConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({ data: { user: { id: "user-abc" } } });
    mockSingle.mockResolvedValue({
      data: {
        heartbeat_enabled: true,
        heartbeat_interval_hours: 4,
      },
      error: null,
    });
  });

  // No afterEach needed - Vitest cleans up
});
```

**Chained Query Verification:**
```typescript
it("PATCHes the correct user_agents row", async () => {
  const { result } = renderHook(() => useHeartbeatConfig(AGENT_TYPE_ID));

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  await act(async () => {
    await result.current.updateConfig({ heartbeat_interval_hours: 2 });
  });

  // Verify entire query chain
  expect(mockFrom).toHaveBeenCalledWith("user_agents");
  expect(mockUpdate).toHaveBeenCalledWith({ heartbeat_interval_hours: 2 });
  expect(mockUpdateEqOuter).toHaveBeenCalledWith("user_id", "user-abc");
  expect(mockUpdateEqInner).toHaveBeenCalledWith(
    "agent_type_id",
    AGENT_TYPE_ID,
  );
});
```

**TODO Tests (Planned but Not Yet Implemented):**
```typescript
it.todo('subscribe() calls Notification.requestPermission and registers service worker');
it.todo('unsubscribe() removes push_subscriptions row and sets isSubscribed=false');
```

## Known Gaps

- Some hooks have `.todo()` specs (not yet implemented)
- Integration tests for push subscription not yet written
- No snapshot testing
- No E2E tests (Playwright/Cypress not installed)

---

*Testing analysis: 2026-03-18*
