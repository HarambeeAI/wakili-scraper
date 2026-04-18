import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import CalendarLayout from "@/components/calendar/CalendarLayout";
import ChatSidebar from "@/components/chat/ChatSidebar";

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

  return (
    <div className="flex h-screen bg-white">
      <ChatSidebar
        orgName={org.name}
        orgSlug={orgSlug}
        logoUrl={org.logoUrl}
        activePage="calendar"
      />
      <div className="flex-1 flex flex-col min-w-0 border-l border-border">
        <CalendarLayout orgId={org.id} orgSlug={orgSlug} />
      </div>
    </div>
  );
}
