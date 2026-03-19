import { Wrench } from "lucide-react";

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  accountantTools: "Accountant",
  marketerTools: "Marketer",
  salesTools: "Sales Rep",
  paTools: "Personal Assistant",
  cosTools: "Chief of Staff",
  csTools: "Customer Support",
  legalTools: "Legal",
  hrTools: "HR",
  prTools: "PR",
  procurementTools: "Procurement",
  dataAnalystTools: "Data Analyst",
  operationsTools: "Operations",
};

interface ToolIndicatorProps {
  toolName: string | null;
}

export function ToolIndicator({ toolName }: ToolIndicatorProps) {
  if (toolName === null) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full animate-pulse">
      <Wrench size={16} className="text-muted-foreground" />
      <span className="text-xs font-semibold text-muted-foreground">
        Using {TOOL_DISPLAY_NAMES[toolName] ?? toolName}
      </span>
    </div>
  );
}
