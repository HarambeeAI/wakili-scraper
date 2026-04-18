import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarPosts, brandFiles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateImage, getAspectRatio } from "@/lib/kie/image";
import { generateVideo, getVideoAspectRatio } from "@/lib/kie/video";
import { buildImageGenerationPrompt, buildVideoGenerationPrompt } from "@/lib/agent/prompts/content-prompts";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; postId: string }> },
) {
  const { orgId, postId } = await params;
  const body = await req.json();
  const customPrompt = body.prompt as string | undefined;

  const [post] = await db
    .select()
    .from(calendarPosts)
    .where(and(eq(calendarPosts.id, postId), eq(calendarPosts.organizationId, orgId)));

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const files = await db
    .select()
    .from(brandFiles)
    .where(eq(brandFiles.organizationId, orgId));

  const guidelines = files.find((f) => f.type === "brand_guidelines")?.content || "";
  const profile = files.find((f) => f.type === "business_profile")?.content || "";

  const brandColors = (guidelines.match(/#[0-9A-Fa-f]{6}/g) || []).slice(0, 5);
  const brandPersonality = guidelines.match(/personality[:\s]*([^\n]+)/i)?.[1]?.trim() || "professional";
  const businessType = profile.match(/category[:\s]*([^\n]+)/i)?.[1]?.trim() || "business";
  const businessName = profile.match(/^#\s*(.+)/m)?.[1]?.trim() || "the company";

  await db
    .update(calendarPosts)
    .set({ mediaStatus: "generating", status: "generating", updatedAt: new Date() })
    .where(eq(calendarPosts.id, postId));

  try {
    const isVideo = ["reel", "video", "story"].includes(post.contentFormat);
    let mediaUrl: string;

    if (isVideo) {
      const prompt = customPrompt || buildVideoGenerationPrompt({
        caption: post.caption,
        platform: post.platform,
        contentPillar: post.contentPillar,
        brandPersonality,
        businessName,
        businessType,
        mediaDescription: post.mediaPrompt || post.caption,
      });
      mediaUrl = await generateVideo({ prompt, aspectRatio: getVideoAspectRatio(post.platform) });
    } else {
      const prompt = customPrompt || buildImageGenerationPrompt({
        caption: post.caption,
        platform: post.platform,
        contentPillar: post.contentPillar,
        contentFormat: post.contentFormat,
        brandColors,
        brandFonts: [],
        brandPersonality,
        businessName,
        businessType,
        mediaDescription: post.mediaPrompt || post.caption,
      });
      mediaUrl = await generateImage({ prompt, aspectRatio: getAspectRatio(post.platform, post.contentFormat) });
    }

    const [updated] = await db
      .update(calendarPosts)
      .set({
        mediaUrl,
        mediaType: isVideo ? "video" : "image",
        mediaStatus: "completed",
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(calendarPosts.id, postId))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    await db
      .update(calendarPosts)
      .set({ mediaStatus: "failed", status: "failed", updatedAt: new Date() })
      .where(eq(calendarPosts.id, postId));
    return NextResponse.json({ error: "Content generation failed" }, { status: 500 });
  }
}
