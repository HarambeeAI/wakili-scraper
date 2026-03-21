import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  Megaphone,
  UserCheck,
  UserCircle,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  ArrowRight,
  Mail,
  Calendar,
  DollarSign,
  Image,
  Clock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { ActiveView } from "@/pages/Dashboard";
import { TaskList } from "./TaskList";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { AutomationPanel } from "./AutomationPanel";

interface DashboardOverviewProps {
  onNavigate: (view: ActiveView) => void;
}

interface ImpactMetrics {
  hoursSaved: number;
  tasksCompleted: number;
  moneyEquivalent: number;
  emailsProcessed: number;
  postsCreated: number;
  leadsGenerated: number;
  invoicesManaged: number;
}

export function DashboardOverview({ onNavigate }: DashboardOverviewProps) {
  const { token } = useAuth();
  const [stats, setStats] = useState({
    totalInvoices: 0,
    pendingInvoices: 0,
    totalLeads: 0,
    scheduledPosts: 0,
    urgentEmails: 0,
    todaysMeetings: 0,
    totalIncome: 0,
    totalExpenses: 0,
  });
  const [impactMetrics, setImpactMetrics] = useState<ImpactMetrics>({
    hoursSaved: 0,
    tasksCompleted: 0,
    moneyEquivalent: 0,
    emailsProcessed: 0,
    postsCreated: 0,
    leadsGenerated: 0,
    invoicesManaged: 0,
  });
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    const fetchStats = async () => {
      try {
        const [invoices, leads, transactions, completedTasks] = await Promise.all([
          api.get<{ status: string; amount: number }[]>("/api/invoices", { token }),
          api.get<{ id: string }[]>("/api/leads", { token }),
          api.get<{ type: string; amount: number }[]>("/api/transactions", { token }),
          api.get<{ id: string }[]>("/api/agent-tasks?status=completed", { token }),
        ]);

        const totalIncome = (invoices ? [] : []).concat(transactions || []).filter((t: any) => t.type === "income").reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        const totalExpenses = (transactions || []).filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
        const scheduledPosts = 0;
        const urgentEmails = 0;
        const todaysMeetings = 0;

        setStats({
          totalInvoices: (invoices || []).length,
          pendingInvoices: (invoices || []).filter((i) => i.status === "pending").length,
          totalLeads: (leads || []).length,
          scheduledPosts,
          urgentEmails,
          todaysMeetings,
          totalIncome: (transactions || []).filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0),
          totalExpenses,
        });

        const tasksCompleted = (completedTasks || []).length;
        const leadsGenerated = (leads || []).length;
        const invoicesManaged = (invoices || []).length;

        const hoursSaved = (
          (tasksCompleted * 15) +
          (urgentEmails * 5) +
          (scheduledPosts * 30) +
          (leadsGenerated * 20) +
          (invoicesManaged * 10)
        ) / 60;

        const moneyEquivalent = hoursSaved * 50;

        setImpactMetrics({
          hoursSaved: Math.round(hoursSaved * 10) / 10,
          tasksCompleted,
          moneyEquivalent: Math.round(moneyEquivalent),
          emailsProcessed: urgentEmails,
          postsCreated: scheduledPosts,
          leadsGenerated,
          invoicesManaged,
        });
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      }
    };

    fetchStats();
  }, [token]);

  const agents = [
    {
      id: "assistant" as const,
      name: "AI Personal Assistant",
      description: "Manage emails, calendar, and daily priorities",
      icon: UserCircle,
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
      borderColor: "border-l-sky-500",
      metrics: [
        { label: "Urgent Emails", value: stats.urgentEmails, icon: Mail },
        { label: "Today's Meetings", value: stats.todaysMeetings, icon: Calendar },
      ],
    },
    {
      id: "accountant" as const,
      name: "AI Accountant",
      description: "Track invoices, manage cashflow, generate financial reports",
      icon: Calculator,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-l-emerald-500",
      metrics: [
        { label: "Net Cashflow", value: `$${(stats.totalIncome - stats.totalExpenses).toLocaleString()}`, icon: DollarSign },
        { label: "Pending Invoices", value: stats.pendingInvoices, icon: FileText },
        { label: "Income", value: `$${stats.totalIncome.toLocaleString()}`, icon: TrendingUp },
        { label: "Expenses", value: `$${stats.totalExpenses.toLocaleString()}`, icon: TrendingDown },
      ],
    },
    {
      id: "marketer" as const,
      name: "AI Marketer",
      description: "Create content, schedule posts, manage your social presence",
      icon: Megaphone,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
      borderColor: "border-l-violet-500",
      metrics: [
        { label: "Scheduled Posts", value: stats.scheduledPosts, icon: Image },
      ],
    },
    {
      id: "sales" as const,
      name: "AI Sales Rep",
      description: "Find leads, send outreach, track your sales pipeline",
      icon: UserCheck,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-l-amber-500",
      metrics: [{ label: "Total Leads", value: stats.totalLeads, icon: Users }],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Your AI team is ready to help</p>
      </div>

      {/* Impact Metrics Section */}
      <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Your AI Team's Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hours Saved */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="p-3 rounded-full bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {impactMetrics.hoursSaved}
                  <span className="text-lg font-normal text-muted-foreground ml-1">hrs</span>
                </p>
                <p className="text-sm text-muted-foreground">Time Saved</p>
              </div>
            </div>

            {/* Tasks Completed */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="p-3 rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {impactMetrics.tasksCompleted}
                </p>
                <p className="text-sm text-muted-foreground">Tasks Completed</p>
              </div>
            </div>

            {/* Money Equivalent */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-border/50">
              <div className="p-3 rounded-full bg-amber-500/10">
                <DollarSign className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">
                  ${impactMetrics.moneyEquivalent.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Value Generated</p>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Breakdown by activity:</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-muted/50">
                {impactMetrics.emailsProcessed} emails processed
              </span>
              <span className="px-2 py-1 rounded-full bg-muted/50">
                {impactMetrics.postsCreated} posts created
              </span>
              <span className="px-2 py-1 rounded-full bg-muted/50">
                {impactMetrics.leadsGenerated} leads generated
              </span>
              <span className="px-2 py-1 rounded-full bg-muted/50">
                {impactMetrics.invoicesManaged} invoices managed
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automation Panel */}
      <AutomationPanel />

      {/* Two Column Layout: Tasks + Agents */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Task List */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Agent Tasks</h2>
          <TaskList onCreateTask={() => setCreateTaskOpen(true)} />
        </div>

        {/* AI Agents with Integrated Metrics */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Your AI Team</h2>
          <div className="space-y-4">
            {agents.map((agent) => (
              <Card key={agent.id} className={`hover:shadow-md transition-shadow border-l-4 ${agent.borderColor}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${agent.bgColor}`}>
                        <agent.icon className={`h-5 w-5 ${agent.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <CardDescription className="text-sm">{agent.description}</CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onNavigate(agent.id)}>
                      Open <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 ml-[48px]">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {agent.metrics.map((metric) => (
                      <div key={metric.label} className="flex items-center gap-2 text-sm">
                        <metric.icon className={`h-4 w-4 ${agent.color}`} />
                        <span className="text-muted-foreground">{metric.label}:</span>
                        <span className="font-semibold">{metric.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        onTaskCreated={() => setCreateTaskOpen(false)}
      />
    </div>
  );
}
