import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  organizations,
  agentRuns,
  brandFiles,
  chatMessages,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createBrandDNAGraph } from "@/lib/agent/graph";

// In-memory store for SSE connections per agent run
const runEventEmitters = new Map<
  string,
  Array<(event: string, data: Record<string, unknown>) => void>
>();

export function getEventEmitters(runId: string) {
  return runEventEmitters.get(runId) || [];
}

export function registerListener(
  runId: string,
  listener: (event: string, data: Record<string, unknown>) => void,
) {
  if (!runEventEmitters.has(runId)) {
    runEventEmitters.set(runId, []);
  }
  runEventEmitters.get(runId)!.push(listener);

  return () => {
    const listeners = runEventEmitters.get(runId);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx > -1) listeners.splice(idx, 1);
      if (listeners.length === 0) runEventEmitters.delete(runId);
    }
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { websiteUrl, selectedServices } = body;

  // Derive org name and slug from the website URL
  const domain = new URL(websiteUrl).hostname.replace("www.", "");
  const orgName = domain.split(".")[0];
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  // Create or update organization
  let org: typeof organizations.$inferSelect;
  const existing = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(organizations)
      .set({
        websiteUrl,
        selectedServices,
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, existing[0].id))
      .returning();
    org = updated;
  } else {
    const [created] = await db
      .insert(organizations)
      .values({
        name: orgName.charAt(0).toUpperCase() + orgName.slice(1),
        slug,
        websiteUrl,
        selectedServices,
        onboardingCompleted: true,
      })
      .returning();
    org = created;
  }

  const organizationId = org.id;

  // Create agent run
  const [run] = await db
    .insert(agentRuns)
    .values({
      organizationId,
      status: "running",
      startedAt: new Date(),
      tasks: {
        plan_tasks: "pending",
        crawl_website: "pending",
        extract_brand: "pending",
        generate_profile: "pending",
        research_market: "pending",
        generate_strategy: "pending",
        synthesize: "pending",
      },
    })
    .returning();

  // Run the agent in the background
  const graph = createBrandDNAGraph();

  const emitEvent = (event: string, data: Record<string, unknown>) => {
    const listeners = getEventEmitters(run.id);
    listeners.forEach((listener) => {
      try {
        listener(event, data);
      } catch {
        // SSE connection may have closed — don't crash the agent
      }
    });

    // Persist chat messages to DB
    if (event === "message" || event === "status") {
      db.insert(chatMessages)
        .values({
          organizationId,
          role: ((data.role as string) || "system") as
            | "agent"
            | "user"
            | "system",
          content: (data.content as string) || (data.message as string) || "",
          type: event === "status" ? "status" : "text",
        })
        .catch(console.error);
    }

    if (event === "file_card") {
      db.insert(brandFiles)
        .values({
          organizationId,
          type: data.type as
            | "business_profile"
            | "brand_guidelines"
            | "market_research"
            | "marketing_strategy",
          title: data.title as string,
          content: data.content as string,
          metadata: {},
        })
        .returning()
        .then(([file]) => {
          db.insert(chatMessages)
            .values({
              organizationId,
              role: "agent",
              content: data.title as string,
              type: "file_card",
              fileId: file.id,
            })
            .catch(console.error);
        })
        .catch(console.error);
    }
  };

  // Fire and forget
  graph
    .invoke({
      websiteUrl,
      selectedServices,
      organizationId,
      emitEvent,
    })
    .then(async () => {
      db.update(agentRuns)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(agentRuns.id, run.id))
        .catch(console.error);
      // Delay complete event so the client can process start_calendar_wizard first
      await new Promise((r) => setTimeout(r, 2000));
      emitEvent("complete", { status: "completed", filesGenerated: 4 });
    })
    .catch((error) => {
      console.error("Agent run failed:", error);
      db.update(agentRuns)
        .set({ status: "failed" })
        .where(eq(agentRuns.id, run.id))
        .catch(console.error);
      emitEvent("error", { message: "Analysis failed. Please try again." });
    });

  return NextResponse.json({
    runId: run.id,
    orgSlug: org.slug,
  });
}
