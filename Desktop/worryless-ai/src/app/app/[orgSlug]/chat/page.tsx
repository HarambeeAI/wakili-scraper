import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ChatLayout from "@/components/chat/ChatLayout";

interface ChatPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { orgSlug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) notFound();

  return (
    <ChatLayout
      orgSlug={orgSlug}
      orgId={org.id}
      logoUrl={org.logoUrl}
    />
  );
}
