import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getNotifications: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;

    const { rows } = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId],
    );

    res.json(rows);
  } catch (error) {
    console.error('[notifications] getNotifications error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const markNotificationRead: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { id } = req.params;

    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [id, userId],
    );

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[notifications] markNotificationRead error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const markAllNotificationsRead: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;

    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId],
    );

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[notifications] markAllNotificationsRead error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
