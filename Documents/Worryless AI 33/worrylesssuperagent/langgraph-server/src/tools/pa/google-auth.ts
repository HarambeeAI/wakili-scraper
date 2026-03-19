import { google } from "googleapis";
import { getPool } from "../shared/db.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export async function getGoogleClient(userId: string) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT access_token, refresh_token, token_expires_at
     FROM public.integrations
     WHERE user_id = $1 AND provider = 'google' AND is_active = true`,
    [userId]
  );
  if (rows.length === 0) {
    throw new Error("Google integration not connected. Please set up Google OAuth in Settings to use email, calendar, and drive features.");
  }
  const { access_token, refresh_token, token_expires_at } = rows[0];

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token,
    refresh_token,
    expiry_date: new Date(token_expires_at).getTime(),
  });

  // Auto-refresh handler: persist new tokens back to DB
  oauth2Client.on("tokens", async (tokens) => {
    const updates: string[] = [];
    const values: unknown[] = [userId];
    let paramIdx = 2;
    if (tokens.access_token) {
      updates.push(`access_token = $${paramIdx++}`);
      values.push(tokens.access_token);
    }
    if (tokens.refresh_token) {
      updates.push(`refresh_token = $${paramIdx++}`);
      values.push(tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      updates.push(`token_expires_at = $${paramIdx++}`);
      values.push(new Date(tokens.expiry_date).toISOString());
    }
    if (updates.length > 0) {
      await db.query(
        `UPDATE public.integrations SET ${updates.join(", ")} WHERE user_id = $1 AND provider = 'google'`,
        values
      ).catch((err) => console.error("[google-auth] Token refresh persist failed:", err));
    }
  });

  return oauth2Client;
}
