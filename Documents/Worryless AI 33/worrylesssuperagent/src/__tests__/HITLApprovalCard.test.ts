/// <reference types="vitest/globals" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { HITLApprovalCard } from "@/components/chat/HITLApprovalCard";

const baseApproval = {
  id: "approval-123",
  action: "send invoice",
  agentType: "accountant",
  description: "Send invoice #1001 to Client Corp for $5,000",
  payload: { invoiceId: "inv-1001" },
};

describe("HITLApprovalCard", () => {
  it("renders 'Action Requires Your Approval' title", () => {
    render(
      React.createElement(HITLApprovalCard, {
        approval: baseApproval,
        onApprove: vi.fn(),
        onReject: vi.fn(),
        onDiscuss: vi.fn(),
      })
    );
    expect(screen.getByText("Action Requires Your Approval")).toBeTruthy();
  });

  it("renders Approve, Reject, and Discuss buttons", () => {
    render(
      React.createElement(HITLApprovalCard, {
        approval: baseApproval,
        onApprove: vi.fn(),
        onReject: vi.fn(),
        onDiscuss: vi.fn(),
      })
    );
    expect(screen.getByRole("button", { name: /approve/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /reject/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /discuss/i })).toBeTruthy();
  });

  it("clicking Approve calls onApprove with approval id", () => {
    const onApprove = vi.fn();
    render(
      React.createElement(HITLApprovalCard, {
        approval: baseApproval,
        onApprove,
        onReject: vi.fn(),
        onDiscuss: vi.fn(),
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledWith("approval-123");
  });

  it("clicking Reject calls onReject with approval id", () => {
    const onReject = vi.fn();
    render(
      React.createElement(HITLApprovalCard, {
        approval: baseApproval,
        onApprove: vi.fn(),
        onReject,
        onDiscuss: vi.fn(),
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(onReject).toHaveBeenCalledWith("approval-123");
  });

  it("after approve, card shows 'Approved' badge and dims to 60% opacity", () => {
    const { container } = render(
      React.createElement(HITLApprovalCard, {
        approval: baseApproval,
        onApprove: vi.fn(),
        onReject: vi.fn(),
        onDiscuss: vi.fn(),
        status: "approved",
      })
    );
    expect(screen.getByText("Approved")).toBeTruthy();
    // Card root should have opacity-60 class
    const card = container.querySelector(".opacity-60");
    expect(card).toBeTruthy();
    // Buttons should not be present
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
  });
});
