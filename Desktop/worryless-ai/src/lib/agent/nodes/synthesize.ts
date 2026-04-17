import type { AgentStateType } from "../state";

export async function synthesize(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const domain = new URL(state.websiteUrl).hostname.replace("www.", "");
  const companyName = state.siteMetadata?.title?.split(/[|\-–]/)[0]?.trim()
    || domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1);

  state.emitEvent("message", {
    role: "agent",
    content: `All done! I've completed the full brand DNA analysis for ${companyName}. Here's what I've built for you:\n\n- **Business Profile** — product overview, traction, pricing, and value props\n- **Brand Guidelines** — colors, typography, tone, and UI patterns\n- **Market Research** — market sizing, competitors, keywords, and audience pain points\n- **Marketing Strategy** — channel strategies, content pillars, and 30-day quick wins\n\nYou can find all four files in your Brand Knowledge Base. Let me know if you'd like me to dig deeper into anything.`,
  });

  state.emitEvent("complete", {
    status: "completed",
    filesGenerated: 4,
  });

  return {};
}
