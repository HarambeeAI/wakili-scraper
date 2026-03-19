// MKT-04: Schedule posts + MKT-12: Content library management
// Queries public.social_posts and public.agent_assets using the shared DB pool

import { getPool } from "../shared/db.js";
import type { SocialPlatform, ContentAsset, AgentAssetRow } from "./types.js";

/**
 * MKT-04: Schedules a post for future publishing.
 * Writes to social_posts with status='scheduled' and scheduled_at set.
 */
export async function schedulePost(
  userId: string,
  platform: SocialPlatform,
  content: string,
  scheduledAt: string,
  imageUrl?: string,
): Promise<string> {
  const db = getPool();
  const result = await db.query<{ id: string }>(
    `INSERT INTO public.social_posts (user_id, platform, content, image_url, scheduled_at, status)
     VALUES ($1, $2, $3, $4, $5, 'scheduled')
     RETURNING id`,
    [userId, platform, content, imageUrl ?? null, scheduledAt],
  );
  return result.rows[0].id;
}

/**
 * MKT-12: Search and manage the content library (past assets).
 * Queries agent_assets filtered by user, agent_type='marketer', optional text search and type filter.
 */
export async function manageContentLibrary(
  userId: string,
  query?: string,
  assetType?: string,
): Promise<ContentAsset[]> {
  const db = getPool();
  let sql = `SELECT id, asset_type, title, content, metadata, created_at
             FROM public.agent_assets
             WHERE user_id = $1 AND agent_type = 'marketer'`;
  const params: unknown[] = [userId];

  if (assetType) {
    params.push(assetType);
    sql += ` AND asset_type = $${params.length}`;
  }

  if (query) {
    params.push(`%${query}%`);
    sql += ` AND title ILIKE $${params.length}`;
  }

  sql += ` ORDER BY created_at DESC LIMIT 50`;

  const result = await db.query<AgentAssetRow>(sql, params);

  return result.rows.map((row) => ({
    id: row.id,
    assetType: row.asset_type,
    title: row.title,
    content: row.content.slice(0, 200), // Truncate large base64 content in response
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}
