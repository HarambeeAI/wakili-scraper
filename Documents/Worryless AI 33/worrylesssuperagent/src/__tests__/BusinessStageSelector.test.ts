import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { BusinessStageSelector } from "@/components/onboarding/BusinessStageSelector";

describe("BusinessStageSelector", () => {
  let mockOnSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnSelect = vi.fn();
  });

  it("renders 3 option cards with correct labels", () => {
    render(
      React.createElement(BusinessStageSelector, {
        value: "",
        onSelect: mockOnSelect,
      }),
    );
    expect(screen.getByText("Starting")).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.getByText("Scaling")).toBeTruthy();
  });

  it("calls onSelect with correct value when an option is clicked", () => {
    render(
      React.createElement(BusinessStageSelector, {
        value: "",
        onSelect: mockOnSelect,
      }),
    );
    const runningButton = screen.getByRole("radio", { name: /running/i });
    fireEvent.click(runningButton);
    expect(mockOnSelect).toHaveBeenCalledWith("running");
  });

  it("selected option shows border-primary class", () => {
    render(
      React.createElement(BusinessStageSelector, {
        value: "starting",
        onSelect: mockOnSelect,
      }),
    );
    const startingButton = screen.getByRole("radio", { name: /starting/i });
    expect(startingButton.className).toContain("border-primary");
  });

  it("uses role radiogroup for accessibility", () => {
    render(
      React.createElement(BusinessStageSelector, {
        value: "",
        onSelect: mockOnSelect,
      }),
    );
    expect(screen.getByRole("radiogroup")).toBeTruthy();
  });
});
