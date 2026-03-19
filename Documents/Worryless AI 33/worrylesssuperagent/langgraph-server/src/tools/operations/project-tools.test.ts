import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB pool
const mockQuery = vi.fn();

vi.mock("../shared/db.js", () => ({
  getPool: vi.fn().mockReturnValue({
    query: mockQuery,
  }),
}));

// Mock LLM client for draftSOP
vi.mock("../../llm/client.js", () => ({
  callLLM: vi.fn(),
  callLLMWithStructuredOutput: vi.fn().mockResolvedValue({
    data: {
      title: "Onboarding New Employees",
      purpose: "Ensure a consistent and positive onboarding experience",
      steps: [
        {
          stepNumber: 1,
          action: "Send welcome email",
          responsible: "HR Manager",
          notes: "Use template in Drive",
        },
        {
          stepNumber: 2,
          action: "Set up workstation",
          responsible: "IT",
          notes: "Follow IT checklist",
        },
        {
          stepNumber: 3,
          action: "Schedule 1:1 with manager",
          responsible: "Manager",
          notes: "First week",
        },
      ],
    },
    tokensUsed: 250,
  }),
}));

describe("operations tools", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  describe("createProject", () => {
    it("inserts a new project and returns its id", async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: "proj-123" }] });

      const { createProject } = await import("./project-tools.js");
      const result = await createProject(
        "user-1",
        "Launch Website",
        "Main site launch",
        "2026-04-01",
        "2026-06-30",
      );

      expect(result.projectId).toBe("proj-123");
      expect(result.message).toContain("Launch Website");
      expect(result.message).toContain("Project created");

      // Verify it inserted into public.projects
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("public.projects"),
        expect.arrayContaining(["user-1", "Launch Website"]),
      );
    });

    it("creates project with minimal required fields", async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: "proj-456" }] });

      const { createProject } = await import("./project-tools.js");
      const result = await createProject("user-1", "Quick Project");

      expect(result.projectId).toBe("proj-456");
      expect(result.message).toContain("Quick Project");
    });
  });

  describe("addMilestone", () => {
    it("inserts milestone after verifying project ownership", async () => {
      // First query: project ownership check
      // Second query: milestone insert
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: "proj-123", name: "Launch Website" }],
        })
        .mockResolvedValueOnce({ rows: [{ id: "ms-789" }] });

      const { addMilestone } = await import("./project-tools.js");
      const result = await addMilestone(
        "user-1",
        "proj-123",
        "Design complete",
        "2026-05-01",
        "Designer",
      );

      expect(result.milestoneId).toBe("ms-789");
      expect(result.message).toContain("Launch Website");
      expect(result.message).toContain("Design complete");
      expect(result.error).toBeUndefined();

      // Verify project ownership was checked
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("public.projects"),
        ["proj-123", "user-1"],
      );
      // Verify milestone was inserted into project_milestones
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("project_milestones"),
        expect.arrayContaining(["proj-123", "Design complete"]),
      );
    });

    it("returns error when project does not belong to user", async () => {
      mockQuery.mockResolvedValue({ rows: [] }); // No project found

      const { addMilestone } = await import("./project-tools.js");
      const result = await addMilestone("user-1", "proj-other", "Milestone");

      expect(result.error).toBeDefined();
      expect(result.error).toContain("not found");
      expect(result.milestoneId).toBe("");
    });
  });

  describe("listProjects", () => {
    it("returns projects with status summary", async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: "p1",
            user_id: "user-1",
            name: "Project A",
            status: "active",
            description: null,
            start_date: null,
            due_date: null,
            completed_at: null,
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
          },
          {
            id: "p2",
            user_id: "user-1",
            name: "Project B",
            status: "planning",
            description: null,
            start_date: null,
            due_date: null,
            completed_at: null,
            created_at: "2026-01-02",
            updated_at: "2026-01-02",
          },
          {
            id: "p3",
            user_id: "user-1",
            name: "Project C",
            status: "completed",
            description: null,
            start_date: null,
            due_date: null,
            completed_at: null,
            created_at: "2026-01-03",
            updated_at: "2026-01-03",
          },
        ],
      });

      const { listProjects } = await import("./project-tools.js");
      const result = await listProjects("user-1");

      expect(result.projects).toHaveLength(3);
      expect(result.summary.activeCount).toBe(1);
      expect(result.summary.planningCount).toBe(1);
      expect(result.summary.completedCount).toBe(1);
      expect(result.summary.onHoldCount).toBe(0);
      expect(result.message).toContain("1 active");
      expect(result.message).toContain("1 planning");
    });

    it("returns empty message when no projects found", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { listProjects } = await import("./project-tools.js");
      const result = await listProjects("user-1");

      expect(result.projects).toHaveLength(0);
      expect(result.message).toBe("No projects found.");
    });

    it("filters by status when provided", async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: "p1",
            user_id: "user-1",
            name: "Active Project",
            status: "active",
            description: null,
            start_date: null,
            due_date: null,
            completed_at: null,
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
          },
        ],
      });

      const { listProjects } = await import("./project-tools.js");
      await listProjects("user-1", "active");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = $2"),
        ["user-1", "active"],
      );
    });
  });

  describe("analyzeBottlenecks", () => {
    it("finds blocked milestones across projects", async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            title: "API Integration",
            due_date: "2026-04-15",
            owner: "Dev Team",
            project_name: "Platform Launch",
          },
          {
            title: "Design Review",
            due_date: "2026-04-10",
            owner: "Design Lead",
            project_name: "Brand Refresh",
          },
          {
            title: "Legal Sign-off",
            due_date: "2026-04-20",
            owner: "Legal",
            project_name: "Platform Launch",
          },
        ],
      });

      const { analyzeBottlenecks } = await import("./project-tools.js");
      const result = await analyzeBottlenecks("user-1");

      expect(result.blockedCount).toBe(3);
      expect(result.projectCount).toBe(2); // Platform Launch + Brand Refresh
      expect(result.blockedMilestones).toHaveLength(3);
      expect(result.message).toContain("3 blocked milestone(s)");
      expect(result.message).toContain("2 project(s)");

      // Verify it queries for 'blocked' status
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("pm.status = 'blocked'"),
        ["user-1"],
      );
    });

    it("returns no bottlenecks message when all milestones are on track", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { analyzeBottlenecks } = await import("./project-tools.js");
      const result = await analyzeBottlenecks("user-1");

      expect(result.blockedCount).toBe(0);
      expect(result.blockedMilestones).toHaveLength(0);
      expect(result.message).toContain("No bottlenecks detected");
    });
  });

  describe("draftSOP", () => {
    it("calls LLM with structured output and returns SOP document", async () => {
      const { draftSOP } = await import("./process-tools.js");
      const result = await draftSOP(
        "user-1",
        "Employee Onboarding",
        "Tech startup context",
      );

      expect(result.title).toBe("Onboarding New Employees");
      expect(result.purpose).toBeTruthy();
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].stepNumber).toBe(1);
      expect(result.steps[0].action).toBeTruthy();
      expect(result.steps[0].responsible).toBeTruthy();
      expect(result.message).toContain("SOP drafted");
      expect(result.message).toContain("Onboarding New Employees");
    });

    it("works without optional context parameter", async () => {
      const { draftSOP } = await import("./process-tools.js");
      const result = await draftSOP("user-1", "Invoice Processing");

      expect(result.title).toBeTruthy();
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });
});
