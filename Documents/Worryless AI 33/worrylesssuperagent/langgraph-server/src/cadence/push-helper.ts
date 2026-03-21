/**
 * push-helper.ts — web-push VAPID notification wrapper
 *
 * Sends push notifications to all user subscriptions stored in push_subscriptions table.
 * Gracefully no-ops if VAPID keys are not configured (development or missing secret).
 *
 * Called by cadence-worker.ts after a non-empty heartbeat result to notify the user.
 */

import webpush from "web-push";
import { getPool } from "../tools/shared/db.js";

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn(
      "[push-helper] VAPID keys not set — push notifications disabled",
    );
    return false;
  }
  webpush.setVapidDetails(
    "mailto:admin@worryless.ai",
    publicKey,
    privateKey,
  );
  vapidConfigured = true;
  return true;
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
): Promise<void> {
  if (!ensureVapid()) return;

  const pool = getPool();
  const { rows: subs } = await pool.query<{
    endpoint: string;
    p256dh: string;
    auth: string;
  }>(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
    [userId],
  );

  for (const sub of subs) {
    await webpush
      .sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body }),
      )
      .catch((err) => {
        console.error(
          "[push-helper] Push failed (non-fatal):",
          err instanceof Error ? err.message : err,
        );
      });
  }
}
