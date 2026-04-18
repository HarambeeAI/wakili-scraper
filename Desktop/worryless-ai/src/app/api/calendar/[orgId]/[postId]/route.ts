import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarPosts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; postId: string }> },
) {
  const { orgId, postId } = await params;

  const [post] = await db
    .select()
    .from(calendarPosts)
    .where(and(eq(calendarPosts.id, postId), eq(calendarPosts.organizationId, orgId)));

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  return NextResponse.json(post);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; postId: string }> },
) {
  const { orgId, postId } = await params;
  const updates = await req.json();

  const [updated] = await db
    .update(calendarPosts)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(calendarPosts.id, postId), eq(calendarPosts.organizationId, orgId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; postId: string }> },
) {
  const { orgId, postId } = await params;

  await db
    .delete(calendarPosts)
    .where(and(eq(calendarPosts.id, postId), eq(calendarPosts.organizationId, orgId)));

  return NextResponse.json({ deleted: true });
}
