import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures mock objects are available inside vi.mock factories
const { mockGmailList, mockGmailGet, mockGmailSend, mockGoogleClient, mockCallLLM, mockCallLLMStructured, mockInterrupt } =
  vi.hoisted(() => {
    const mockGmailList = vi.fn();
    const mockGmailGet = vi.fn();
    const mockGmailSend = vi.fn();

    const mockGoogleClient = vi.fn().mockResolvedValue({});

    const mockCallLLM = vi.fn().mockResolvedValue({
      content: "This is a draft reply.",
      tokensUsed: 100,
    });

    const mockCallLLMStructured = vi.fn().mockResolvedValue({
      data: { emails: [] },
      tokensUsed: 100,
    });

    const mockInterrupt = vi.fn().mockReturnValue({ approved: true });

    return {
      mockGmailList,
      mockGmailGet,
      mockGmailSend,
      mockGoogleClient,
      mockCallLLM,
      mockCallLLMStructured,
      mockInterrupt,
    };
  });

// Mock googleapis
vi.mock("googleapis", () => {
  const gmailInstance = {
    users: {
      messages: {
        list: mockGmailList,
        get: mockGmailGet,
        send: mockGmailSend,
      },
    },
  };
  return {
    google: {
      gmail: vi.fn(() => gmailInstance),
    },
  };
});

// Mock google-auth
vi.mock("./google-auth.js", () => ({
  getGoogleClient: mockGoogleClient,
}));

// Mock LLM client
vi.mock("../../llm/client.js", () => ({
  callLLM: mockCallLLM,
  callLLMWithStructuredOutput: mockCallLLMStructured,
}));

// Mock HITL interrupt handler
vi.mock("../../hitl/interrupt-handler.js", () => ({
  interruptForApproval: mockInterrupt,
}));

import { readEmails, triageInbox, draftEmailResponse, sendEmail } from "./email-tools.js";

const MOCK_MESSAGE_LIST = {
  data: {
    messages: [
      { id: "msg-001", threadId: "thread-001" },
      { id: "msg-002", threadId: "thread-002" },
    ],
  },
};

const MOCK_MESSAGE_DETAIL_1 = {
  data: {
    id: "msg-001",
    threadId: "thread-001",
    snippet: "Hey, just following up on the invoice...",
    labelIds: ["INBOX"],
    payload: {
      headers: [
        { name: "From", value: "alice@example.com" },
        { name: "To", value: "me@worryless.ai" },
        { name: "Subject", value: "Invoice follow-up" },
        { name: "Date", value: "Thu, 19 Mar 2026 09:00:00 +0000" },
      ],
    },
  },
};

const MOCK_MESSAGE_DETAIL_2 = {
  data: {
    id: "msg-002",
    threadId: "thread-002",
    snippet: "Meeting request for next week...",
    labelIds: ["INBOX"],
    payload: {
      headers: [
        { name: "From", value: "bob@partner.com" },
        { name: "To", value: "me@worryless.ai" },
        { name: "Subject", value: "Meeting request" },
        { name: "Date", value: "Thu, 19 Mar 2026 10:00:00 +0000" },
      ],
    },
  },
};

describe("email-tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoogleClient.mockResolvedValue({});
    mockCallLLM.mockResolvedValue({ content: "This is a draft reply.", tokensUsed: 100 });
    mockCallLLMStructured.mockResolvedValue({ data: { emails: [] }, tokensUsed: 100 });
    mockInterrupt.mockReturnValue({ approved: true });
  });

  // PA-01
  describe("readEmails", () => {
    it("returns structured email list", async () => {
      mockGmailList.mockResolvedValueOnce(MOCK_MESSAGE_LIST);
      mockGmailGet
        .mockResolvedValueOnce(MOCK_MESSAGE_DETAIL_1)
        .mockResolvedValueOnce(MOCK_MESSAGE_DETAIL_2);

      const result = await readEmails("user-1");

      expect(result.count).toBe(2);
      expect(result.emails).toHaveLength(2);
      expect(result.emails[0].id).toBe("msg-001");
      expect(result.emails[0].subject).toBe("Invoice follow-up");
      expect(result.emails[0].from).toBe("alice@example.com");
      expect(result.emails[0].snippet).toBe("Hey, just following up on the invoice...");
      expect(result.emails[0].labelIds).toContain("INBOX");
    });

    it("returns empty when no messages in inbox", async () => {
      mockGmailList.mockResolvedValueOnce({ data: { messages: [] } });

      const result = await readEmails("user-1");

      expect(result.count).toBe(0);
      expect(result.emails).toHaveLength(0);
    });

    it("returns empty when messages list is undefined", async () => {
      mockGmailList.mockResolvedValueOnce({ data: {} });

      const result = await readEmails("user-1");

      expect(result.count).toBe(0);
      expect(result.emails).toHaveLength(0);
    });
  });

  // PA-02
  describe("triageInbox", () => {
    it("categorizes emails by urgency", async () => {
      mockGmailList.mockResolvedValueOnce(MOCK_MESSAGE_LIST);
      mockGmailGet
        .mockResolvedValueOnce(MOCK_MESSAGE_DETAIL_1)
        .mockResolvedValueOnce(MOCK_MESSAGE_DETAIL_2);

      mockCallLLMStructured.mockResolvedValueOnce({
        data: {
          emails: [
            {
              id: "msg-001",
              urgency: "urgent",
              topic: "Finance",
              suggestedAction: "respond",
              reason: "Invoice needs immediate attention",
            },
            {
              id: "msg-002",
              urgency: "normal",
              topic: "Scheduling",
              suggestedAction: "respond",
              reason: "Meeting request - routine",
            },
          ],
        },
        tokensUsed: 150,
      });

      const result = await triageInbox("user-1");

      expect(result.triaged).toHaveLength(2);
      expect(result.triaged[0].urgency).toBe("urgent");
      expect(result.triaged[0].topic).toBe("Finance");
      expect(result.triaged[1].urgency).toBe("normal");
      expect(result.summary).toContain("1 urgent");
      expect(result.summary).toContain("1 normal");
    });

    it("returns empty summary when inbox is clear", async () => {
      mockGmailList.mockResolvedValueOnce({ data: { messages: [] } });

      const result = await triageInbox("user-1");

      expect(result.triaged).toHaveLength(0);
      expect(result.summary).toBe("Your inbox is clear -- no new emails.");
    });
  });

  // PA-03
  describe("draftEmailResponse", () => {
    it("returns styled draft email", async () => {
      mockGmailGet.mockResolvedValueOnce({
        data: {
          id: "msg-001",
          threadId: "thread-001",
          payload: {
            headers: [
              { name: "From", value: "alice@example.com" },
              { name: "Subject", value: "Invoice follow-up" },
            ],
            body: {
              data: Buffer.from("Please send me the invoice asap.").toString("base64"),
            },
          },
        },
      });

      mockCallLLM.mockResolvedValueOnce({
        content: "Hi Alice, thank you for your message. I'll send the invoice shortly.",
        tokensUsed: 80,
      });

      const draft = await draftEmailResponse("user-1", "msg-001");

      expect(draft.to).toBe("alice@example.com");
      expect(draft.subject).toBe("Re: Invoice follow-up");
      expect(draft.body).toBe("Hi Alice, thank you for your message. I'll send the invoice shortly.");
      expect(draft.threadId).toBe("thread-001");
      expect(draft.inReplyTo).toBe("msg-001");
    });

    it("includes user instructions in prompt", async () => {
      mockGmailGet.mockResolvedValueOnce({
        data: {
          id: "msg-003",
          threadId: "thread-003",
          payload: {
            headers: [
              { name: "From", value: "charlie@client.com" },
              { name: "Subject", value: "Partnership enquiry" },
            ],
          },
        },
      });

      mockCallLLM.mockResolvedValueOnce({ content: "Reply drafted.", tokensUsed: 50 });

      await draftEmailResponse("user-1", "msg-003", "Keep it brief and professional");

      // Verify callLLM was called with instructions
      expect(mockCallLLM).toHaveBeenCalledOnce();
      const callArgs = mockCallLLM.mock.calls[0][0];
      const humanMsg = callArgs.find((m: any) => m._getType?.() === "human" || m.constructor?.name === "HumanMessage");
      expect(humanMsg?.content).toContain("Keep it brief and professional");
    });
  });

  // PA-04
  describe("sendEmail", () => {
    const mockEmail = {
      to: "alice@example.com",
      subject: "Re: Invoice follow-up",
      body: "Hi Alice, here is the invoice.",
      threadId: "thread-001",
    };

    it("calls interruptForApproval before Gmail API send", async () => {
      mockInterrupt.mockReturnValueOnce({ approved: true });
      mockGmailSend.mockResolvedValueOnce({ data: { id: "sent-msg-001" } });

      const result = await sendEmail("user-1", "personal_assistant", mockEmail);

      expect(mockInterrupt).toHaveBeenCalledOnce();
      expect(mockInterrupt).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "send_email",
          agentType: "personal_assistant",
        }),
      );
      expect(mockGmailSend).toHaveBeenCalledOnce();
      expect(result.sent).toBe(true);
      expect(result.messageId).toBe("sent-msg-001");
      expect(result.message).toContain("alice@example.com");
    });

    it("returns cancelled when not approved by user", async () => {
      mockInterrupt.mockReturnValueOnce({ approved: false });

      const result = await sendEmail("user-1", "personal_assistant", mockEmail);

      expect(mockInterrupt).toHaveBeenCalledOnce();
      expect(mockGmailSend).not.toHaveBeenCalled();
      expect(result.sent).toBe(false);
      expect(result.message).toBe("Email send cancelled by user.");
    });

    it("encodes email with base64url and includes threadId", async () => {
      mockInterrupt.mockReturnValueOnce({ approved: true });
      mockGmailSend.mockResolvedValueOnce({ data: { id: "sent-msg-002" } });

      await sendEmail("user-1", "personal_assistant", mockEmail);

      const sendCall = mockGmailSend.mock.calls[0][0];
      expect(sendCall.requestBody.raw).toBeDefined();
      expect(sendCall.requestBody.raw).not.toContain("+");
      expect(sendCall.requestBody.raw).not.toContain("/");
      expect(sendCall.requestBody.threadId).toBe("thread-001");
    });
  });
});
