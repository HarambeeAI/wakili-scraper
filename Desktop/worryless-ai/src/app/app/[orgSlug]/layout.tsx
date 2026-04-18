import { db } from "@/lib/db";
import { organizations, agentRuns } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import AppShell from "./AppShell";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) notFound();

  // Find latest running agent run
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

  const runId = latestRun?.id || null;

  return (
    <AppShell
      runId={runId}
      orgSlug={orgSlug}
      orgName={org.name}
      orgId={org.id}
      logoUrl={org.logoUrl}
    >
      {children}
    </AppShell>
  );
}
