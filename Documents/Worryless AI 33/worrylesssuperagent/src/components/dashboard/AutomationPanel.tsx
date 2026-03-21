import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  Calculator,
  Megaphone,
  UserCheck,
  UserCircle,
  Play,
  Pause,
  Loader2,
  Shield,
  ShieldAlert
} from "lucide-react";
import { toast } from "sonner";

interface AutomationSettings {
  agent_type: string;
  is_enabled: boolean;
}

interface TaskTemplate {
  id: string;
  agent_type: string;
  title: string;
  description: string;
  frequency: string;
  risk_level: string;
  is_active: boolean;
  schedule_cron: string;
}

interface PendingApproval {
  id: string;
  agent_type: string;
  title: string | null;
  response: string | null;
  created_at: string;
  task_config: Record<string, unknown> | null;
}

const agentIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  accountant: Calculator,
  marketer: Megaphone,
  sales_rep: UserCheck,
  personal_assistant: UserCircle,
};

const agentLabels: Record<string, string> = {
  accountant: "Accountant",
  marketer: "Marketer",
  sales_rep: "Sales Rep",
  personal_assistant: "Personal Assistant",
};

const agentColors: Record<string, string> = {
  accountant: "text-emerald-500",
  marketer: "text-violet-500",
  sales_rep: "text-amber-500",
  personal_assistant: "text-sky-500",
};

export function AutomationPanel() {
  const { token, userId } = useAuth();
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [settings, setSettings] = useState<AutomationSettings[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);

  useEffect(() => {
    fetchAutomationStatus();
    fetchPendingApprovals();
  }, [token]);

  const fetchAutomationStatus = async () => {
    if (!token) return;
    try {
      const profile = await api.get<{ automation_enabled?: boolean }>("/api/profiles/me", { token });
      setAutomationEnabled(profile?.automation_enabled || false);
      // automation_settings and task_templates are not yet migrated routes — keep empty
      setSettings([]);
      setTemplates([]);
    } catch (error) {
      console.error("Error fetching automation status:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingApprovals = async () => {
    if (!token) return;
    try {
      const data = await api.get<PendingApproval[]>("/api/tasks?status=needs_approval", { token });
      setPendingApprovals(data || []);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
    }
  };

  const toggleAutomation = async () => {
    if (!token || !userId) return;
    try {
      setInitializing(true);
      const action = automationEnabled ? "disable" : (templates.length > 0 ? "enable" : "initialize");

      await api.post("/api/planning-agent", { userId, action }, { token });

      setAutomationEnabled(!automationEnabled);
      toast.success(automationEnabled ? "Automation paused" : "Automation activated!");

      await fetchAutomationStatus();
    } catch (error) {
      console.error("Error toggling automation:", error);
      toast.error("Failed to toggle automation");
    } finally {
      setInitializing(false);
    }
  };

  const approveTask = async (taskId: string) => {
    if (!token) return;
    try {
      await api.patch(`/api/tasks/${taskId}`, { status: "running" }, { token });
      toast.success("Task approved and executing...");
      fetchPendingApprovals();
    } catch (error) {
      console.error("Error approving task:", error);
      toast.error("Failed to approve task");
    }
  };

  const rejectTask = async (taskId: string) => {
    if (!token) return;
    try {
      await api.patch(`/api/tasks/${taskId}`, { status: "failed", response: "Rejected by user" }, { token });
      toast.success("Task rejected");
      fetchPendingApprovals();
    } catch (error) {
      console.error("Error rejecting task:", error);
      toast.error("Failed to reject task");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Automation Control */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Autonomous Mode
                  {automationEnabled && (
                    <Badge variant="default" className="bg-green-500">
                      <Zap className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Let your AI agents run your business automatically
                </CardDescription>
              </div>
            </div>
            <Button
              size="lg"
              variant={automationEnabled ? "outline" : "default"}
              onClick={toggleAutomation}
              disabled={initializing}
            >
              {initializing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : automationEnabled ? (
                <Pause className="h-4 w-4 mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {initializing ? "Processing..." : automationEnabled ? "Pause Automation" : "Activate Automation"}
            </Button>
          </div>
        </CardHeader>
        {automationEnabled && (
          <CardContent>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{templates.filter(t => t.is_active).length} scheduled tasks</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span>{templates.filter(t => t.risk_level === "low").length} auto-execute</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span>{templates.filter(t => t.risk_level === "high").length} need approval</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {automationEnabled && (
        <Tabs defaultValue="approvals" className="w-full">
          <TabsList>
            <TabsTrigger value="approvals" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Pending Approvals
              {pendingApprovals.length > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingApprovals.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Task Schedule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="approvals" className="mt-4">
            {pendingApprovals.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>No pending approvals</p>
                  <p className="text-sm">High-risk tasks will appear here for your review</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((task) => {
                  const AgentIcon = agentIcons[task.agent_type] || Bot;
                  return (
                    <Card key={task.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <AgentIcon className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <CardTitle className="text-base">{task.title}</CardTitle>
                              <CardDescription>
                                {agentLabels[task.agent_type]} • {new Date(task.created_at).toLocaleString()}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            Needs Approval
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-muted/50 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
                          <p className="text-sm whitespace-pre-wrap">{task.response?.slice(0, 500)}...</p>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => rejectTask(task.id)}>
                            Reject
                          </Button>
                          <Button size="sm" onClick={() => approveTask(task.id)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve & Execute
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {["personal_assistant", "accountant", "marketer", "sales_rep"].map((agentType) => {
                const AgentIcon = agentIcons[agentType];
                const agentTemplates = templates.filter(t => t.agent_type === agentType);
                const colorClass = agentColors[agentType] || "text-muted-foreground";

                return (
                  <Card key={agentType}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <AgentIcon className={`h-5 w-5 ${colorClass}`} />
                        <CardTitle className="text-base">{agentLabels[agentType]}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {agentTemplates.map((template) => (
                          <div
                            key={template.id}
                            className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              {template.risk_level === "high" ? (
                                <ShieldAlert className="h-3 w-3 text-amber-500" />
                              ) : (
                                <Shield className="h-3 w-3 text-green-500" />
                              )}
                              <span className="truncate max-w-[120px]">{template.title}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {template.frequency}
                            </Badge>
                          </div>
                        ))}
                        {agentTemplates.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            No tasks scheduled
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
