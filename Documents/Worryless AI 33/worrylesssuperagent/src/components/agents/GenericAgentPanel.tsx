import { Bot, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceTabs } from "./workspace/WorkspaceTabs";
import { HeartbeatConfigSection } from "./HeartbeatConfigSection";
import { CadenceConfigSection } from "./CadenceConfigSection";

interface GenericAgentPanelProps {
  agentTypeId: string;
  displayName: string;
  description: string;
}

export function GenericAgentPanel({
  agentTypeId,
  displayName,
  description,
}: GenericAgentPanelProps) {
  const { userId } = useAuth();
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

  return (
    <>
      <Card className="h-full">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex flex-row items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>{displayName}</CardTitle>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsWorkspaceOpen(true)}
          >
            <Settings2 className="h-4 w-4 mr-1" />
            Workspace
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground gap-2 p-6">
            <Bot className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              Chat for <strong>{displayName}</strong> is coming soon.
            </p>
            <p className="text-xs opacity-60">Agent ID: {agentTypeId}</p>
          </div>
          <HeartbeatConfigSection agentTypeId={agentTypeId} />
          <CadenceConfigSection agentTypeId={agentTypeId} />
        </CardContent>
      </Card>

      <Dialog open={isWorkspaceOpen} onOpenChange={setIsWorkspaceOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Agent Workspace &mdash; {displayName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {userId ? (
              <WorkspaceTabs userId={userId} agentTypeId={agentTypeId} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Loading...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
