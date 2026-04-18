import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import CalendarLayout from "@/components/calendar/CalendarLayout";

interface CalendarPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function CalendarPage({ params }: CalendarPageProps) {
  const { orgSlug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) notFound();

  return <CalendarLayout orgId={org.id} orgSlug={orgSlug} />;
}
