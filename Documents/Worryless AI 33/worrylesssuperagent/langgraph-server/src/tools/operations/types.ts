// Operations tool type contracts (OPS-07)

export interface OpsClassification {
  isCreateProject: boolean;
  isTrackMilestones: boolean;
  isListProjects: boolean;
  isAnalyzeBottlenecks: boolean;
  isDraftSOP: boolean;
}

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  due_date: string | null;
  completed_at: string | null;
  owner: string | null;
  created_at: string;
}

export interface BottleneckAnalysis {
  blockedMilestones: Array<{ milestoneTitle: string; projectName: string; dueDate: string | null; owner: string | null }>;
  blockedCount: number;
  projectCount: number;
}

export interface SOPDocument {
  title: string;
  purpose: string;
  steps: Array<{ stepNumber: number; action: string; responsible: string; notes: string }>;
}

export interface ProjectStatusSummary {
  activeCount: number;
  planningCount: number;
  onHoldCount: number;
  completedCount: number;
}
