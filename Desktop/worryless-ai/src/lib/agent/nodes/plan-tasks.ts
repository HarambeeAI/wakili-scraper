import type { AgentStateType } from "../state";

export async function planTasks(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const domain = new URL(state.websiteUrl).hostname.replace("www.", "");
  const companyName = domain.split(".")[0];
  const capitalizedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);

  state.emitEvent("message", {
    role: "agent",
    content: `Let me dive right in — starting with your website and brand to get a clear picture of what ${capitalizedName} is all about.`,
  });

  state.emitEvent("status", {
    task: "plan_tasks",
    message: "Planning analysis tasks",
  });

  return {};
}
