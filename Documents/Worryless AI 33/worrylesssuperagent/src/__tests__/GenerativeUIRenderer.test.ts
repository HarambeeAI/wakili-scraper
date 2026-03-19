/// <reference types="vitest/globals" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { GenerativeUIRenderer } from "@/components/chat/GenerativeUIRenderer";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => React.createElement("div", { "data-testid": "chart" }, children),
  BarChart: ({ children }: any) => React.createElement("div", null, children),
  Bar: () => null,
  LineChart: ({ children }: any) => React.createElement("div", null, children),
  Line: () => null,
  PieChart: ({ children }: any) => React.createElement("div", null, children),
  Pie: () => null,
  Cell: () => null,
  AreaChart: ({ children }: any) => React.createElement("div", null, children),
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe("GenerativeUIRenderer", () => {
  it("renders pl_report type without crash", () => {
    const { container } = render(
      React.createElement(GenerativeUIRenderer, {
        components: [
          {
            type: "pl_report",
            props: {
              rows: [],
              columns: [],
            },
          },
        ],
      })
    );
    expect(container).toBeTruthy();
  });

  it("renders data_table type and DataTable component appears in DOM", () => {
    render(
      React.createElement(GenerativeUIRenderer, {
        components: [
          {
            type: "data_table",
            props: {
              data: [{ name: "Alice", amount: 100 }],
              columns: [
                { key: "name", label: "Name" },
                { key: "amount", label: "Amount" },
              ],
            },
          },
        ],
      })
    );
    // DataTable renders a table element
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("renders hitl_approval type and HITLApprovalCard appears", () => {
    render(
      React.createElement(GenerativeUIRenderer, {
        components: [
          {
            type: "hitl_approval",
            props: {
              id: "approval-1",
              action: "send email",
              agentType: "accountant",
              description: "Send invoice to client",
              payload: {},
              onApprove: vi.fn(),
              onReject: vi.fn(),
              onDiscuss: vi.fn(),
            },
          },
        ],
      })
    );
    expect(screen.getByText("Action Requires Your Approval")).toBeTruthy();
  });

  it("renders bar_chart type without crash", () => {
    const { container } = render(
      React.createElement(GenerativeUIRenderer, {
        components: [
          {
            type: "bar_chart",
            props: {
              data: [{ name: "Jan", value: 400 }],
              xKey: "name",
              yKey: "value",
            },
          },
        ],
      })
    );
    expect(container).toBeTruthy();
  });

  it("unknown type renders nothing (null)", () => {
    const { container } = render(
      React.createElement(GenerativeUIRenderer, {
        components: [
          {
            type: "unknown_type_xyz",
            props: {},
          },
        ],
      })
    );
    // The outer wrapper div exists, but the unknown type renders null inside
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toBeTruthy();
    // The inner content for unknown type should be empty
    expect(wrapper.children.length).toBe(0);
  });

  it("empty components array renders empty container", () => {
    const { container } = render(
      React.createElement(GenerativeUIRenderer, {
        components: [],
      })
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.children.length).toBe(0);
  });

  it("renders dynamic_form type and DynamicForm renders input fields from schema", () => {
    render(
      React.createElement(GenerativeUIRenderer, {
        components: [
          {
            type: "dynamic_form",
            props: {
              schema: [
                { name: "firstName", label: "First Name", type: "text", placeholder: "Enter name" },
                { name: "age", label: "Age", type: "number" },
              ],
              title: "Test Form",
              onSubmit: vi.fn(),
            },
          },
        ],
      })
    );
    expect(screen.getByLabelText("First Name")).toBeTruthy();
    expect(screen.getByLabelText("Age")).toBeTruthy();
  });
});
