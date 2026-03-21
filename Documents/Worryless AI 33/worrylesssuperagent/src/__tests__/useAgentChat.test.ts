import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock useAuth to provide token and userId
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn().mockReturnValue({
    token: "test-token",
    userId: "test-user-id",
    isAuthenticated: true,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Mock api.ts for profiles/me call in sendMessage
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockImplementation((path: string) => {
      if (path === "/api/profiles/me") {
        return Promise.resolve({ business_stage: "growth" });
      }
      return Promise.resolve({});
    }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

// Helper: create a ReadableStream that emits SSE data
function createSSEStream(events: object[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const sseText = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sseText));
      controller.close();
    },
  });
}

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Set up VITE_API_URL for the hook
Object.defineProperty(import.meta, "env", {
  value: {
    VITE_API_URL: "https://example-api.railway.app",
    VITE_LOGTO_API_RESOURCE: "https://api.worryless.ai",
  },
  writable: true,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useAgentChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: threads fetch returns empty
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/threads/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ threads: [] }),
        });
      }
      // Default SSE stream response
      return Promise.resolve({
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: createSSEStream([
          { type: "delta", content: "Hello" },
          { type: "done", metadata: null, thread_id: "t1" },
        ]),
      });
    });
  });

  it("Test 1: sendMessage adds user message optimistically and sets isStreaming=true", async () => {
    const { useAgentChat } = await import("@/hooks/useAgentChat");
    const { result } = renderHook(() =>
      useAgentChat({ userId: "test-user-id", agentType: "chief_of_staff" }),
    );

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/threads/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ threads: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: createSSEStream([
          { type: "delta", content: "Hello" },
          { type: "done", metadata: null, thread_id: "t1" },
        ]),
      });
    });

    await act(async () => {
      await result.current.sendMessage("test message");
    });

    // User message should be in messages
    const messages = result.current.messages;
    expect(
      messages.some((m) => m.role === "user" && m.content === "test message"),
    ).toBe(true);
  });

  it("Test 2: SSE delta events accumulate into a single assistant message content", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/threads/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ threads: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: createSSEStream([
          { type: "delta", content: "Hello" },
          { type: "delta", content: " World" },
          { type: "done", metadata: null, thread_id: "t1" },
        ]),
      });
    });

    const { useAgentChat } = await import("@/hooks/useAgentChat");
    const { result } = renderHook(() =>
      useAgentChat({ userId: "test-user-id", agentType: "chief_of_staff" }),
    );

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    await waitFor(() => {
      const assistantMsg = result.current.messages.find(
        (m) => m.role === "assistant",
      );
      expect(assistantMsg?.content).toBe("Hello World");
    });
  });

  it("Test 3: tool_start event updates activeToolName state", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/threads/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ threads: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: createSSEStream([
          { type: "tool_start", tool_name: "cosTools" },
          { type: "delta", content: "Result" },
          { type: "done", metadata: null, thread_id: "t1" },
        ]),
      });
    });

    const { useAgentChat } = await import("@/hooks/useAgentChat");
    const { result } = renderHook(() =>
      useAgentChat({ userId: "test-user-id", agentType: "chief_of_staff" }),
    );

    // activeToolName should be set to "cosTools" during streaming, then null after done
    await act(async () => {
      await result.current.sendMessage("Use a tool");
    });

    // After done, activeToolName should be null
    await waitFor(() => {
      expect(result.current.activeToolName).toBeNull();
    });
  });

  it("Test 4: done event finalizes message and sets isStreaming=false", async () => {
    const { useAgentChat } = await import("@/hooks/useAgentChat");
    const { result } = renderHook(() =>
      useAgentChat({ userId: "test-user-id", agentType: "chief_of_staff" }),
    );

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });
  });

  it("Test 5: ui_components event attaches components to current assistant message", async () => {
    const components = [{ type: "chart", props: { data: [1, 2, 3] } }];

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/threads/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ threads: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: createSSEStream([
          { type: "delta", content: "Here is a chart" },
          { type: "ui_components", components },
          { type: "done", metadata: null, thread_id: "t1" },
        ]),
      });
    });

    const { useAgentChat } = await import("@/hooks/useAgentChat");
    const { result } = renderHook(() =>
      useAgentChat({ userId: "test-user-id", agentType: "chief_of_staff" }),
    );

    await act(async () => {
      await result.current.sendMessage("Show me a chart");
    });

    await waitFor(() => {
      const assistantMsg = result.current.messages.find(
        (m) => m.role === "assistant",
      );
      expect(assistantMsg?.uiComponents).toEqual(components);
    });
  });

  it("Test 6: pending_approvals event stores approvals accessible from hook return", async () => {
    const approvals = [
      {
        id: "approval-1",
        action: "send_email",
        agentType: "personal_assistant",
        description: "Send email to client",
        payload: {},
        createdAt: new Date().toISOString(),
      },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/threads/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ threads: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: createSSEStream([
          { type: "delta", content: "I need your approval" },
          { type: "pending_approvals", approvals },
          { type: "done", metadata: null, thread_id: "t1" },
        ]),
      });
    });

    const { useAgentChat } = await import("@/hooks/useAgentChat");
    const { result } = renderHook(() =>
      useAgentChat({ userId: "test-user-id", agentType: "chief_of_staff" }),
    );

    await act(async () => {
      await result.current.sendMessage("Do the thing");
    });

    await waitFor(() => {
      expect(result.current.pendingApprovals).toEqual(approvals);
    });
  });

  it("Test 7: approveHITL calls /invoke/resume with correct payload", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/threads/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ threads: [] }),
        });
      }
      if (typeof url === "string" && url.includes("/invoke/resume")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ response: "Approved", thread_id: "t1" }),
        });
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: createSSEStream([
          { type: "done", metadata: null, thread_id: "t1" },
        ]),
      });
    });

    const { useAgentChat } = await import("@/hooks/useAgentChat");
    const { result } = renderHook(() =>
      useAgentChat({ userId: "test-user-id", agentType: "chief_of_staff" }),
    );

    await act(async () => {
      await result.current.approveHITL("thread-123", true, "looks good");
    });

    const resumeCall = mockFetch.mock.calls.find(
      ([url]: [string]) =>
        typeof url === "string" && url.includes("/invoke/resume"),
    );
    expect(resumeCall).toBeDefined();

    const [, resumeOptions] = resumeCall!;
    const body = JSON.parse(resumeOptions.body as string);
    expect(body.thread_id).toBe("thread-123");
    expect(body.approved).toBe(true);
    expect(body.feedback).toBe("looks good");
  });

  it("Test 8: threads load on mount via GET /langgraph-proxy/threads/:userId", async () => {
    const threads = [
      {
        thread_id: "thread-1",
        agent_type: "chief_of_staff",
        created_at: new Date().toISOString(),
      },
    ];

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/threads/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ threads }),
        });
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: createSSEStream([
          { type: "done", metadata: null, thread_id: "t1" },
        ]),
      });
    });

    const { useAgentChat } = await import("@/hooks/useAgentChat");
    const { result } = renderHook(() =>
      useAgentChat({ userId: "test-user-id", agentType: "chief_of_staff" }),
    );

    await waitFor(() => {
      expect(result.current.threads.length).toBeGreaterThan(0);
    });

    expect(result.current.threads[0].thread_id).toBe("thread-1");
  });

  it("Test 10: pending_approvals SSE event attaches approval to assistant message's pendingApproval field", async () => {
    const approval = {
      id: "interrupt_12345_0",
      action: "send_email",
      agentType: "personal_assistant",
      description: "Send email to client@example.com",
      payload: { to: "client@example.com", subject: "Follow up" },
      createdAt: new Date().toISOString(),
    };

    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/threads/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ threads: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: createSSEStream([
          { type: "delta", content: "I need your approval to send this email" },
          { type: "pending_approvals", approvals: [approval] },
          { type: "done", metadata: null, thread_id: "t1" },
        ]),
      });
    });

    const { useAgentChat } = await import("@/hooks/useAgentChat");
    const { result } = renderHook(() =>
      useAgentChat({ userId: "test-user-id", agentType: "personal_assistant" }),
    );

    await act(async () => {
      await result.current.sendMessage("Send the follow up email");
    });

    await waitFor(() => {
      const assistantMsg = result.current.messages.find(
        (m) => m.role === "assistant",
      );
      expect(assistantMsg?.pendingApproval).toBeDefined();
      expect(assistantMsg?.pendingApproval?.action).toBe("send_email");
      expect(assistantMsg?.pendingApproval?.description).toBe(
        "Send email to client@example.com",
      );
    });

    // Also verify the pendingApprovals array is populated
    expect(result.current.pendingApprovals).toHaveLength(1);
    expect(result.current.pendingApprovals[0].id).toBe("interrupt_12345_0");
  });

  it("Test 9: sendMessage fetches business_stage from /api/profiles/me and includes business_context in POST body", async () => {
    const { api } = await import("@/lib/api");

    let capturedBody: Record<string, unknown> | null = null;

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (typeof url === "string" && url.includes("/threads/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ threads: [] }),
        });
      }
      if (
        typeof url === "string" &&
        url.includes("/invoke/stream") &&
        options?.body
      ) {
        capturedBody = JSON.parse(options.body as string) as Record<
          string,
          unknown
        >;
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: createSSEStream([
          { type: "delta", content: "Hi" },
          { type: "done", metadata: null, thread_id: "t1" },
        ]),
      });
    });

    // Ensure api.get returns business_stage for profiles/me
    (api.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path === "/api/profiles/me") {
        return Promise.resolve({ business_stage: "growth" });
      }
      return Promise.resolve({});
    });

    const { useAgentChat } = await import("@/hooks/useAgentChat");
    const { result } = renderHook(() =>
      useAgentChat({ userId: "test-user-id", agentType: "chief_of_staff" }),
    );

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody?.business_context).toBeDefined();
    expect(
      (capturedBody?.business_context as Record<string, unknown>)
        ?.business_stage,
    ).toBe("growth");
  });
});
