import { db } from "@/lib/db";
import { organizations, agentRuns } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import ChatLayout from "@/components/chat/ChatLayout";

interface ChatPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ runId?: string }>;
}

export default async function ChatPage({
  params,
  searchParams,
}: ChatPageProps) {
  const { orgSlug } = await params;
  const { runId: queryRunId } = await searchParams;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) notFound();

  let runId = queryRunId || null;
  if (!runId) {
    const [latestRun] = await db
      .select()
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.organizationId, org.id),
          eq(agentRuns.status, "running"),
        ),
      )
      .orderBy(desc(agentRuns.startedAt))
      .limit(1);
    runId = latestRun?.id || null;
  }

  return (
    <ChatLayout
      runId={runId}
      orgSlug={orgSlug}
      orgName={org.name}
      orgId={org.id}
      logoUrl={org.logoUrl}
    />
  );
}
