import type { RequestHandler } from 'express';
import webpush from 'web-push';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

// Configure VAPID on module load
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@worryless.ai',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export const createPushSubscription: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'endpoint, keys.p256dh, and keys.auth are required' });
      return;
    }

    // Delete any existing subscription with same endpoint for this user, then insert
    // (avoids needing a unique constraint that may not exist)
    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint],
    );

    const { rows } = await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, endpoint, keys.p256dh, keys.auth],
    );

    res.status(201).json({ id: rows[0].id });
  } catch (error) {
    console.error('[push-subscriptions] Create error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deletePushSubscription: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { endpoint } = req.body;

    if (!endpoint) {
      res.status(400).json({ error: 'endpoint is required' });
      return;
    }

    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint],
    );

    res.json({ status: 'deleted' });
  } catch (error) {
    console.error('[push-subscriptions] Delete error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// Exported for use by the scheduling system (Phase 23)
export async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; [key: string]: unknown },
): Promise<void> {
  await webpush.sendNotification(
    { endpoint: subscription.endpoint, keys: subscription.keys },
    JSON.stringify(payload),
  );
}
