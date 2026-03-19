import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DataTable } from "@/components/ui/DataTable";
import { HITLApprovalCard } from "./HITLApprovalCard";
import { DynamicForm } from "./DynamicForm";

interface UIComponent {
  type: string;
  props: Record<string, unknown>;
}

interface GenerativeUIRendererProps {
  components: UIComponent[];
}

function renderComponent(comp: UIComponent): React.ReactNode {
  switch (comp.type) {
    case "pl_report":
      return (
        <DataTable
          data={(comp.props.rows as Record<string, unknown>[]) ?? []}
          columns={(comp.props.columns as { key: string; label: string }[]) ?? []}
        />
      );

    case "cashflow_chart":
      return (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={comp.props.data as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={(comp.props.xKey as string) ?? "date"} />
            <YAxis />
            <Tooltip />
            <Area
              type="monotone"
              dataKey={(comp.props.yKey as string) ?? "value"}
              fill="hsl(var(--chart-1))"
              stroke="hsl(var(--chart-1))"
            />
          </AreaChart>
        </ResponsiveContainer>
      );

    case "pipeline_kanban":
      return (
        <div className="text-sm text-muted-foreground py-4">
          Pipeline Kanban (Plan 04)
        </div>
      );

    case "content_calendar":
      return (
        <div className="text-sm text-muted-foreground py-4">
          Content Calendar (Plan 04)
        </div>
      );

    case "invoice_tracker":
      return (
        <DataTable
          data={(comp.props.rows as Record<string, unknown>[]) ?? []}
          columns={(comp.props.columns as { key: string; label: string }[]) ?? []}
        />
      );

    case "calendar_timeline":
      return (
        <div className="text-sm text-muted-foreground py-4">
          Calendar Timeline (Plan 04)
        </div>
      );

    case "meeting_brief":
      return (
        <div className="text-sm text-muted-foreground py-4">
          Meeting Brief (Plan 04)
        </div>
      );

    case "data_table":
      return (
        <DataTable
          data={(comp.props.data as Record<string, unknown>[]) ?? []}
          columns={(comp.props.columns as { key: string; label: string }[]) ?? []}
        />
      );

    case "bar_chart":
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={comp.props.data as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={(comp.props.xKey as string) ?? "name"} />
            <YAxis />
            <Tooltip />
            <Bar
              dataKey={(comp.props.yKey as string) ?? "value"}
              fill="hsl(var(--chart-1))"
            />
          </BarChart>
        </ResponsiveContainer>
      );

    case "line_chart":
      return (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={comp.props.data as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={(comp.props.xKey as string) ?? "date"} />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={(comp.props.yKey as string) ?? "value"}
              stroke="hsl(var(--chart-1))"
            />
          </LineChart>
        </ResponsiveContainer>
      );

    case "pie_chart":
      return (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={comp.props.data as Record<string, unknown>[]}
              dataKey={(comp.props.valueKey as string) ?? "value"}
              nameKey={(comp.props.nameKey as string) ?? "name"}
              cx="50%"
              cy="50%"
              outerRadius={80}
            >
              {(comp.props.data as Record<string, unknown>[])?.map(
                (_: Record<string, unknown>, i: number) => (
                  <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
                )
              )}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );

    case "dynamic_form":
      return (
        <DynamicForm
          schema={comp.props.schema as Parameters<typeof DynamicForm>[0]["schema"]}
          title={comp.props.title as string | undefined}
          onSubmit={
            (comp.props.onSubmit as (v: Record<string, string | number>) => void) ??
            (() => {})
          }
          submitLabel={comp.props.submitLabel as string | undefined}
        />
      );

    case "hitl_approval":
      return (
        <HITLApprovalCard
          approval={comp.props as Parameters<typeof HITLApprovalCard>[0]["approval"]}
          onApprove={(comp.props.onApprove as (id: string) => void) ?? (() => {})}
          onReject={(comp.props.onReject as (id: string) => void) ?? (() => {})}
          onDiscuss={(comp.props.onDiscuss as (id: string) => void) ?? (() => {})}
          status={comp.props.status as "pending" | "approved" | "rejected" | undefined}
        />
      );

    default:
      return null;
  }
}

export function GenerativeUIRenderer({ components }: GenerativeUIRendererProps) {
  return (
    <div className="mt-4 space-y-3">
      {components.map((comp, i) => {
        const node = renderComponent(comp);
        if (node === null) return null;
        return <div key={i}>{node}</div>;
      })}
    </div>
  );
}
