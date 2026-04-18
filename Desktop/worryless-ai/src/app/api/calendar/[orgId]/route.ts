import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarPosts, contentCalendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const searchParams = req.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const platform = searchParams.get("platform");

  const posts = await db
    .select()
    .from(calendarPosts)
    .where(eq(calendarPosts.organizationId, orgId));

  let filtered = posts;
  if (startDate) filtered = filtered.filter((p) => p.scheduledDate >= startDate);
  if (endDate) filtered = filtered.filter((p) => p.scheduledDate <= endDate);
  if (platform) filtered = filtered.filter((p) => p.platform === platform);

  const calendars = await db
    .select()
    .from(contentCalendars)
    .where(eq(contentCalendars.organizationId, orgId));

  return NextResponse.json({
    posts: filtered,
    calendar: calendars[calendars.length - 1] || null,
  });
}
