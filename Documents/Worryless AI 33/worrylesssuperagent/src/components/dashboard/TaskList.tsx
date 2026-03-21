import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calculator, Megaphone, UserCheck, Clock, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type TaskStatus = "pending" | "scheduled" | "running" | "needs_approval" | "completed" | "failed";
type AgentType = "accountant" | "marketer" | "sales_rep";

interface Task {
  id: string;
  title: string | null;
  message: string;
  response: string | null;
  status: TaskStatus;
  agent_type: AgentType;
  is_recurring: boolean;
  schedule_cron: string | null;
  next_run_at: string | null;
  created_at: string;
  completed_at: string | null;
}

const statusConfig: Record<TaskStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground", icon: <Clock className="h-3 w-3" /> },
  scheduled: { label: "Scheduled", color: "bg-chart-4/20 text-chart-4", icon: <Clock className="h-3 w-3" /> },
  running: { label: "Running", color: "bg-chart-2/20 text-chart-2", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  needs_approval: { label: "Needs Approval", color: "bg-chart-5/20 text-chart-5", icon: <AlertCircle className="h-3 w-3" /> },
  completed: { label: "Completed", color: "bg-chart-1/20 text-chart-1", icon: <CheckCircle className="h-3 w-3" /> },
  failed: { label: "Failed", color: "bg-destructive/20 text-destructive", icon: <XCircle className="h-3 w-3" /> },
};

const agentConfig: Record<AgentType, { label: string; icon: React.ReactNode; color: string }> = {
  accountant: { label: "Accountant", icon: <Calculator className="h-4 w-4" />, color: "text-chart-1" },
  marketer: { label: "Marketer", icon: <Megaphone className="h-4 w-4" />, color: "text-chart-2" },
  sales_rep: { label: "Sales Rep", icon: <UserCheck className="h-4 w-4" />, color: "text-chart-3" },
};

interface TaskListProps {
  onCreateTask?: () => void;
}

export function TaskList({ onCreateTask }: TaskListProps) {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    if (!token) return;
    try {
      const data = await api.get<Task[]>("/api/tasks", { token });
      setTasks(data || []);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, [token]);

  const approveTask = async (taskId: string) => {
    if (!token) return;
    try {
      await api.patch(`/api/tasks/${taskId}`, { status: "running" as TaskStatus }, { token });
      fetchTasks();
    } catch (err) {
      console.error("Failed to approve task:", err);
    }
  };

  const activeTasks = tasks.filter(t => ["pending", "scheduled", "running", "needs_approval"].includes(t.status));
  const completedTasks = tasks.filter(t => ["completed", "failed"].includes(t.status));

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Active Tasks</CardTitle>
          {onCreateTask && (
            <Button size="sm" onClick={onCreateTask}>
              + Schedule Task
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {activeTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No active tasks</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {activeTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border bg-card/50 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={agentConfig[task.agent_type].color}>
                          {agentConfig[task.agent_type].icon}
                        </span>
                        <span className="text-sm font-medium">
                          {task.title || task.message.slice(0, 50)}
                        </span>
                      </div>
                      <Badge className={`${statusConfig[task.status].color} flex items-center gap-1`}>
                        {statusConfig[task.status].icon}
                        {statusConfig[task.status].label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{task.message}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {task.is_recurring && (
                          <Badge variant="outline" className="text-xs">Recurring</Badge>
                        )}
                        <span>{formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span>
                      </div>
                      {task.status === "needs_approval" && (
                        <Button size="sm" variant="outline" onClick={() => approveTask(task.id)}>
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Completed</CardTitle>
        </CardHeader>
        <CardContent>
          {completedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No completed tasks</p>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {completedTasks.slice(0, 10).map((task) => (
                  <div
                    key={task.id}
                    className="p-2 rounded-lg border bg-card/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className={agentConfig[task.agent_type].color}>
                        {agentConfig[task.agent_type].icon}
                      </span>
                      <span className="text-sm truncate max-w-[200px]">
                        {task.title || task.message.slice(0, 30)}
                      </span>
                    </div>
                    <Badge className={statusConfig[task.status].color}>
                      {statusConfig[task.status].label}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
