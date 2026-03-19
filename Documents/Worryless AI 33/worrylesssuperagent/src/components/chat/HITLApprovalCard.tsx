import { AlertTriangle, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  chief_of_staff: "Chief of Staff",
  accountant: "Accountant",
  marketer: "Marketer",
  sales_rep: "Sales Rep",
  personal_assistant: "Personal Assistant",
  customer_support: "Customer Support",
  legal: "Legal",
  hr: "HR",
  pr: "PR",
  procurement: "Procurement",
  data_analyst: "Data Analyst",
  operations: "Operations",
};

interface HITLApprovalCardProps {
  approval: {
    id: string;
    action: string;
    agentType: string;
    description: string;
    payload: Record<string, unknown>;
  };
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDiscuss: (id: string) => void;
  status?: "pending" | "approved" | "rejected";
}

export function HITLApprovalCard({
  approval,
  onApprove,
  onReject,
  onDiscuss,
  status = "pending",
}: HITLApprovalCardProps) {
  const { id, action, agentType, description } = approval;
  const agentDisplayName = AGENT_DISPLAY_NAMES[agentType] ?? agentType;

  return (
    <Card
      className={`border-2 border-primary/30 shadow-sm bg-card rounded-lg${status !== "pending" ? " opacity-60" : ""}`}
      role="alertdialog"
      aria-labelledby={`hitl-title-${id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="text-amber-500 h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <h3
              id={`hitl-title-${id}`}
              className="text-[20px] font-semibold leading-tight"
            >
              Action Requires Your Approval
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {agentDisplayName} wants to {action}. Review before proceeding.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{description}</p>

        {status === "pending" && (
          <div className="flex gap-2 mt-4">
            <Button
              variant="default"
              onClick={() => onApprove(id)}
              className="min-w-[80px] min-h-[44px]"
            >
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => onReject(id)}
              className="min-w-[80px] min-h-[44px]"
            >
              Reject
            </Button>
            <Button
              variant="outline"
              onClick={() => onDiscuss(id)}
              className="min-w-[80px] min-h-[44px]"
            >
              Discuss
            </Button>
          </div>
        )}

        {status === "approved" && (
          <div className="mt-4">
            <Badge variant="outline" className="text-green-600">
              <Check className="h-3 w-3 mr-1" />
              Approved
            </Badge>
          </div>
        )}

        {status === "rejected" && (
          <div className="mt-4">
            <Badge variant="outline" className="text-red-600">
              <X className="h-3 w-3 mr-1" />
              Rejected
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
