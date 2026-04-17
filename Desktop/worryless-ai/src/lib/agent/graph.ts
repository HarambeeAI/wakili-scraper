import { StateGraph } from "@langchain/langgraph";
import { AgentState } from "./state";
import { planTasks } from "./nodes/plan-tasks";
import { crawlWebsite } from "./nodes/crawl-website";
import { extractBrand } from "./nodes/extract-brand";
import { generateProfile } from "./nodes/generate-profile";
import { researchMarket } from "./nodes/research-market";
import { generateStrategy } from "./nodes/generate-strategy";
import { synthesize } from "./nodes/synthesize";

export function createBrandDNAGraph() {
  const graph = new StateGraph(AgentState)
    .addNode("plan_tasks", planTasks)
    .addNode("crawl_website", crawlWebsite)
    .addNode("extract_brand", extractBrand)
    .addNode("generate_profile", generateProfile)
    .addNode("research_market", researchMarket)
    .addNode("generate_strategy", generateStrategy)
    .addNode("synthesize", synthesize)
    .addEdge("__start__", "plan_tasks")
    .addEdge("plan_tasks", "crawl_website")
    .addEdge("crawl_website", "extract_brand")
    .addEdge("crawl_website", "generate_profile")
    .addEdge("crawl_website", "research_market")
    .addEdge("extract_brand", "synthesize")
    .addEdge("generate_profile", "synthesize")
    .addEdge("research_market", "generate_strategy")
    .addEdge("generate_strategy", "synthesize");

  return graph.compile();
}
