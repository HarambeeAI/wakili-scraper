import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Calculator, Megaphone, UserCheck, UserCircle } from "lucide-react";

type AgentType = "accountant" | "marketer" | "sales_rep" | "personal_assistant";
type Frequency = "daily" | "weekly" | "monthly" | "hourly";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: () => void;
}

const taskTemplates: Record<AgentType, { title: string; message: string }[]> = {
  personal_assistant: [
    { title: "Daily Morning Briefing", message: "Generate and send a morning briefing with today's priorities, urgent emails, and scheduled meetings" },
    { title: "Email Inbox Summary", message: "Analyze my inbox and provide a summary of important emails that need my attention" },
  ],
  marketer: [
    { title: "Daily Instagram Post", message: "Generate and post engaging content about our latest products/services to Instagram" },
    { title: "Weekly Content Roundup", message: "Create a weekly summary post highlighting our best content and achievements" },
  ],
  accountant: [
    { title: "Daily Invoice Check", message: "Check emails for new invoices and update the invoice tracking system" },
    { title: "Weekly Cashflow Report", message: "Generate a weekly cashflow summary report" },
  ],
  sales_rep: [
    { title: "Daily Lead Outreach", message: "Send personalized outreach emails to the top 5 prospects in the pipeline" },
    { title: "Weekly Pipeline Update", message: "Review and update the status of all leads in the sales pipeline" },
  ],
};

const daysOfWeek = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

const hoursOfDay = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
}));

const daysOfMonth = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}${getOrdinalSuffix(i + 1)}`,
}));

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

const hourIntervals = [
  { value: "1", label: "Every hour" },
  { value: "2", label: "Every 2 hours" },
  { value: "3", label: "Every 3 hours" },
  { value: "4", label: "Every 4 hours" },
  { value: "6", label: "Every 6 hours" },
  { value: "8", label: "Every 8 hours" },
  { value: "12", label: "Every 12 hours" },
];

export function CreateTaskDialog({ open, onOpenChange, onTaskCreated }: CreateTaskDialogProps) {
  const { token } = useAuth();
  const [agentType, setAgentType] = useState<AgentType>("personal_assistant");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isRecurring, setIsRecurring] = useState(true);
  const [loading, setLoading] = useState(false);

  // Schedule state
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [hour, setHour] = useState("9");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [hourInterval, setHourInterval] = useState("6");

  // Build cron expression from selections
  const buildCronExpression = (): string => {
    switch (frequency) {
      case "hourly":
        return `0 */${hourInterval} * * *`;
      case "daily":
        return `0 ${hour} * * *`;
      case "weekly":
        return `0 ${hour} * * ${dayOfWeek}`;
      case "monthly":
        return `0 ${hour} ${dayOfMonth} * *`;
      default:
        return "0 9 * * *";
    }
  };

  const getScheduleDescription = (): string => {
    const timeLabel = hoursOfDay.find(h => h.value === hour)?.label || `${hour}:00`;
    switch (frequency) {
      case "hourly":
        return hourIntervals.find(h => h.value === hourInterval)?.label || "Every few hours";
      case "daily":
        return `Daily at ${timeLabel}`;
      case "weekly":
        const day = daysOfWeek.find(d => d.value === dayOfWeek)?.label || "Monday";
        return `Every ${day} at ${timeLabel}`;
      case "monthly":
        const date = daysOfMonth.find(d => d.value === dayOfMonth)?.label || "1st";
        return `Monthly on the ${date} at ${timeLabel}`;
      default:
        return "";
    }
  };

  const handleTemplateSelect = (template: { title: string; message: string }) => {
    setTitle(template.title);
    setMessage(template.message);
  };

  const handleSubmit = async () => {
    if (!title || !message) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    setLoading(true);

    const scheduleCron = buildCronExpression();

    // Calculate next run time based on selections
    const nextRun = new Date();
    nextRun.setMinutes(0, 0, 0);

    if (frequency === "hourly") {
      const interval = parseInt(hourInterval);
      const currentHour = nextRun.getHours();
      const nextHour = Math.ceil(currentHour / interval) * interval;
      nextRun.setHours(nextHour);
      if (nextRun <= new Date()) {
        nextRun.setHours(nextRun.getHours() + interval);
      }
    } else {
      nextRun.setHours(parseInt(hour));
      if (nextRun <= new Date()) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    }

    try {
      await api.post("/api/tasks", {
        agent_type: agentType,
        title,
        message,
        status: isRecurring ? "scheduled" : "pending",
        is_recurring: isRecurring,
        schedule_cron: isRecurring ? scheduleCron : null,
        next_run_at: isRecurring ? nextRun.toISOString() : null,
      }, { token });

      toast.success(isRecurring ? "Recurring task scheduled" : "Task created");
      setTitle("");
      setMessage("");
      onOpenChange(false);
      onTaskCreated?.();
    } catch (error) {
      toast.error("Failed to create task");
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Agent</Label>
            <Select value={agentType} onValueChange={(v) => setAgentType(v as AgentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal_assistant">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    Personal Assistant
                  </div>
                </SelectItem>
                <SelectItem value="accountant">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Accountant
                  </div>
                </SelectItem>
                <SelectItem value="marketer">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4" />
                    Marketer
                  </div>
                </SelectItem>
                <SelectItem value="sales_rep">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Sales Rep
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quick Templates</Label>
            <div className="flex flex-wrap gap-2">
              {taskTemplates[agentType].map((template, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTemplateSelect(template)}
                >
                  {template.title}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Task Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Daily Instagram Post"
            />
          </div>

          <div className="space-y-2">
            <Label>Task Instructions</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe what the agent should do..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Recurring Task</Label>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {isRecurring && (
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {frequency === "hourly" && (
                <div className="space-y-2">
                  <Label>Interval</Label>
                  <Select value={hourInterval} onValueChange={setHourInterval}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hourIntervals.map((interval) => (
                        <SelectItem key={interval.value} value={interval.value}>
                          {interval.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {frequency !== "hourly" && (
                <div className="grid grid-cols-2 gap-3">
                  {frequency === "weekly" && (
                    <div className="space-y-2">
                      <Label>Day</Label>
                      <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {daysOfWeek.map((day) => (
                            <SelectItem key={day.value} value={day.value}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {frequency === "monthly" && (
                    <div className="space-y-2">
                      <Label>Day of Month</Label>
                      <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {daysOfMonth.map((day) => (
                            <SelectItem key={day.value} value={day.value}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className={`space-y-2 ${frequency === "daily" ? "col-span-2" : ""}`}>
                    <Label>Time</Label>
                    <Select value={hour} onValueChange={setHour}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {hoursOfDay.map((h) => (
                          <SelectItem key={h.value} value={h.value}>
                            {h.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground pt-1">
                Schedule: {getScheduleDescription()}
              </p>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "Creating..." : isRecurring ? "Schedule Task" : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
