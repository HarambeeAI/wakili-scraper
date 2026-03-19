import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/useAgentChat", () => ({
  useAgentChat: vi.fn(),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) =>
    React.createElement("span", {}, children),
}));

vi.mock("@/components/chat/GenerativeUIRenderer", () => ({
  GenerativeUIRenderer: () =>
    React.createElement("div", { "data-testid": "gen-ui" }),
}));

vi.mock("@/components/chat/ToolIndicator", () => ({
  ToolIndicator: () => null,
}));

vi.mock("@/components/chat/StreamingCursor", () => ({
  StreamingCursor: () =>
    React.createElement("span", { "data-testid": "cursor" }),
}));

vi.mock("@/components/chat/HITLApprovalCard", () => ({
  HITLApprovalCard: () =>
    React.createElement("div", { "data-testid": "hitl" }),
}));

vi.mock("@/components/chat/ThreadListSidebar", () => ({
  ThreadListSidebar: () =>
    React.createElement("div", { "data-testid": "thread-sidebar" }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDefaultHookReturn(overrides: Partial<ReturnType<typeof import("@/hooks/useAgentChat")["useAgentChat"]>> = {}) {
  return {
    messages: [],
    threads: [],
    activeThreadId: null,
    setActiveThreadId: vi.fn(),
    isStreaming: false,
    activeToolName: null,
    pendingApprovals: [],
    sendMessage: vi.fn(),
    approveHITL: vi.fn(),
    startNewThread: vi.fn(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AgentChatView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: Empty messages state renders 'Start a conversation' text", async () => {
    const { useAgentChat } = await import("@/hooks/useAgentChat");
    (useAgentChat as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDefaultHookReturn({ messages: [] })
    );

    const { AgentChatView } = await import(
      "@/components/chat/AgentChatView"
    );
    render(
      React.createElement(AgentChatView, {
        agentType: "chief_of_staff",
        userId: "user-123",
      })
    );

    expect(screen.getByText("Start a conversation")).toBeDefined();
  });

  it("Test 2: With messages, renders user message content in the DOM", async () => {
    const { useAgentChat } = await import("@/hooks/useAgentChat");
    (useAgentChat as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDefaultHookReturn({
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "Hello from user",
          },
        ],
      })
    );

    const { AgentChatView } = await import(
      "@/components/chat/AgentChatView"
    );
    render(
      React.createElement(AgentChatView, {
        agentType: "chief_of_staff",
        userId: "user-123",
      })
    );

    expect(screen.getByText("Hello from user")).toBeDefined();
  });

  it("Test 3: With messages, renders assistant message content with ReactMarkdown", async () => {
    const { useAgentChat } = await import("@/hooks/useAgentChat");
    (useAgentChat as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDefaultHookReturn({
        messages: [
          {
            id: "msg-2",
            role: "assistant",
            content: "Here is my response",
          },
        ],
      })
    );

    const { AgentChatView } = await import(
      "@/components/chat/AgentChatView"
    );
    render(
      React.createElement(AgentChatView, {
        agentType: "accountant",
        userId: "user-123",
      })
    );

    // ReactMarkdown mock renders children as span text
    expect(screen.getByText("Here is my response")).toBeDefined();
  });

  it("Test 4: Container has role='log' and aria-live='polite' accessibility attributes", async () => {
    const { useAgentChat } = await import("@/hooks/useAgentChat");
    (useAgentChat as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDefaultHookReturn()
    );

    const { AgentChatView } = await import(
      "@/components/chat/AgentChatView"
    );
    render(
      React.createElement(AgentChatView, {
        agentType: "chief_of_staff",
        userId: "user-123",
      })
    );

    const logRegion = screen.getByRole("log");
    expect(logRegion).toBeDefined();
    expect(logRegion.getAttribute("aria-live")).toBe("polite");
  });

  it("Test 5: Send button is disabled when input is empty", async () => {
    const { useAgentChat } = await import("@/hooks/useAgentChat");
    (useAgentChat as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDefaultHookReturn({ isStreaming: false })
    );

    const { AgentChatView } = await import(
      "@/components/chat/AgentChatView"
    );
    render(
      React.createElement(AgentChatView, {
        agentType: "chief_of_staff",
        userId: "user-123",
      })
    );

    const sendButton = screen.getByRole("button", { name: /send message/i });
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("Test 6: When isStreaming is true, send button is disabled", async () => {
    const { useAgentChat } = await import("@/hooks/useAgentChat");
    (useAgentChat as ReturnType<typeof vi.fn>).mockReturnValue(
      makeDefaultHookReturn({ isStreaming: true })
    );

    const { AgentChatView } = await import(
      "@/components/chat/AgentChatView"
    );
    render(
      React.createElement(AgentChatView, {
        agentType: "chief_of_staff",
        userId: "user-123",
      })
    );

    const sendButton = screen.getByRole("button", { name: /send message/i });
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);
  });
});
