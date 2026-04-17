import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { brandFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const files = await db
    .select()
    .from(brandFiles)
    .where(eq(brandFiles.organizationId, orgId))
    .orderBy(brandFiles.createdAt);

  return NextResponse.json(files);
}
