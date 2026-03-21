import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getSocialPosts: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { rows } = await pool.query(
      'SELECT * FROM social_posts WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    res.json(rows);
  } catch (error) {
    console.error('[social-posts] Get error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createSocialPost: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { platform, content, status, scheduled_for } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO social_posts (user_id, platform, content, status, scheduled_for)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, platform, content, status, scheduled_for],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[social-posts] Create error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteSocialPost: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { id } = req.params;
    await pool.query('DELETE FROM social_posts WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json({ status: 'deleted' });
  } catch (error) {
    console.error('[social-posts] Delete error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
