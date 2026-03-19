// project-tools.ts — Project management, milestone tracking, bottleneck analysis (OPS-07)

import { getPool } from "../shared/db.js";
import type {
  ProjectRow,
  MilestoneRow,
  BottleneckAnalysis,
  ProjectStatusSummary,
} from "./types.js";

// OPS-07: Create a new project for the user
export async function createProject(
  userId: string,
  name: string,
  description?: string,
  startDate?: string,
  dueDate?: string,
): Promise<{ projectId: string; message: string }> {
  const db = getPool();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO public.projects (user_id, name, description, start_date, due_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, name, description ?? null, startDate ?? null, dueDate ?? null],
  );
  const projectId = rows[0].id;
  return {
    projectId,
    message: `Project created: "${name}"`,
  };
}

// OPS-07: Add a milestone to an existing project (verifies project ownership first)
export async function addMilestone(
  userId: string,
  projectId: string,
  title: string,
  dueDate?: string,
  owner?: string,
): Promise<{ milestoneId: string; message: string; error?: string }> {
  const db = getPool();

  // Verify project belongs to user and get its name
  const projectResult = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM public.projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId],
  );
  if (projectResult.rows.length === 0) {
    return {
      milestoneId: "",
      error: `Project "${projectId}" not found or does not belong to user.`,
      message: `Project "${projectId}" not found or does not belong to user.`,
    };
  }
  const projectName = projectResult.rows[0].name;

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO public.project_milestones (project_id, title, due_date, owner)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [projectId, title, dueDate ?? null, owner ?? null],
  );
  const milestoneId = rows[0].id;
  return {
    milestoneId,
    message: `Milestone added to "${projectName}": "${title}"`,
  };
}

// OPS-07: List projects for a user, optionally filtered by status
export async function listProjects(
  userId: string,
  status?: string,
): Promise<{ projects: ProjectRow[]; summary: ProjectStatusSummary; message: string }> {
  const db = getPool();

  const queryParams: unknown[] = [userId];
  let sql = `SELECT * FROM public.projects WHERE user_id = $1`;
  if (status) {
    queryParams.push(status);
    sql += ` AND status = $2`;
  }
  sql += ` ORDER BY created_at DESC`;

  const { rows } = await db.query<ProjectRow>(sql, queryParams);

  if (rows.length === 0) {
    return {
      projects: [],
      summary: { activeCount: 0, planningCount: 0, onHoldCount: 0, completedCount: 0 },
      message: "No projects found.",
    };
  }

  const summary: ProjectStatusSummary = {
    activeCount: rows.filter((p) => p.status === "active").length,
    planningCount: rows.filter((p) => p.status === "planning").length,
    onHoldCount: rows.filter((p) => p.status === "on_hold").length,
    completedCount: rows.filter((p) => p.status === "completed").length,
  };

  return {
    projects: rows,
    summary,
    message: `${summary.activeCount} active, ${summary.planningCount} planning, ${summary.onHoldCount} on hold, ${summary.completedCount} completed`,
  };
}

// OPS-07: Track milestones for a specific project (with optional status update)
export async function trackMilestones(
  userId: string,
  projectId: string,
  milestoneId?: string,
  newStatus?: MilestoneRow["status"],
): Promise<{ milestones: MilestoneRow[]; message: string; error?: string }> {
  const db = getPool();

  // Verify project belongs to user
  const projectResult = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM public.projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId],
  );
  if (projectResult.rows.length === 0) {
    return {
      milestones: [],
      error: `Project "${projectId}" not found or does not belong to user.`,
      message: `Project "${projectId}" not found or does not belong to user.`,
    };
  }

  // If updating a specific milestone status
  if (milestoneId && newStatus) {
    await db.query(
      `UPDATE public.project_milestones
       SET status = $1, completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE NULL END
       WHERE id = $2 AND project_id = $3`,
      [newStatus, milestoneId, projectId],
    );
  }

  const { rows } = await db.query<MilestoneRow>(
    `SELECT pm.*
     FROM public.project_milestones pm
     JOIN public.projects p ON pm.project_id = p.id
     WHERE p.user_id = $1 AND pm.project_id = $2
     ORDER BY pm.due_date ASC NULLS LAST`,
    [userId, projectId],
  );

  return {
    milestones: rows,
    message: `${rows.length} milestone(s) found for project.`,
  };
}

// OPS-07: Analyze bottlenecks by finding blocked milestones across all user projects
export async function analyzeBottlenecks(userId: string): Promise<BottleneckAnalysis & { message: string }> {
  const db = getPool();

  const { rows } = await db.query<{
    title: string;
    due_date: string | null;
    owner: string | null;
    project_name: string;
  }>(
    `SELECT pm.title, pm.due_date::text, pm.owner, p.name AS project_name
     FROM public.project_milestones pm
     JOIN public.projects p ON pm.project_id = p.id
     WHERE p.user_id = $1 AND pm.status = 'blocked'
     ORDER BY pm.due_date ASC NULLS LAST`,
    [userId],
  );

  if (rows.length === 0) {
    return {
      blockedMilestones: [],
      blockedCount: 0,
      projectCount: 0,
      message: "No bottlenecks detected. All milestones are on track.",
    };
  }

  const uniqueProjects = new Set(rows.map((r) => r.project_name));

  return {
    blockedMilestones: rows.map((r) => ({
      milestoneTitle: r.title,
      projectName: r.project_name,
      dueDate: r.due_date,
      owner: r.owner,
    })),
    blockedCount: rows.length,
    projectCount: uniqueProjects.size,
    message: `${rows.length} blocked milestone(s) found across ${uniqueProjects.size} project(s).`,
  };
}
