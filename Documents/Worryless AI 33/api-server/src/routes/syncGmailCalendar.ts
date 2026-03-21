import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const syncGmailCalendar = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.auth!.userId;

    // Get user's Google integration
    const integrationRes = await pool.query(
      `SELECT * FROM integrations WHERE user_id = $1 AND provider = $2 AND is_active = true LIMIT 1`,
      [userId, 'google'],
    );
    const integration = integrationRes.rows[0];

    if (!integration) {
      res.json({
        success: false,
        message: 'Google integration not connected. Please set up Google OAuth to enable Gmail and Calendar sync.',
        emailsProcessed: 0,
        eventsProcessed: 0,
      });
      return;
    }

    // Get business context for AI analysis
    const profileRes = await pool.query(
      `SELECT * FROM profiles WHERE user_id = $1`,
      [userId],
    );
    const profile = profileRes.rows[0];

    const artifactsRes = await pool.query(
      `SELECT * FROM business_artifacts WHERE user_id = $1 LIMIT 10`,
      [userId],
    );
    const artifacts = artifactsRes.rows;

    const businessContext = {
      businessName: profile?.business_name || 'Unknown Business',
      industry: profile?.industry || '',
      description: profile?.company_description || '',
      artifacts: artifacts.map((a: any) => ({ type: a.artifact_type, content: a.content })),
    };

    // For now, return a placeholder response
    // In production, this would:
    // 1. Use the access_token to call Gmail API
    // 2. Fetch and process emails
    // 3. Use Gemini AI to analyze and categorize emails
    // 4. Call Google Calendar API
    // 5. Store results in database

    console.log('Sync requested for user:', userId);
    console.log('Business context:', businessContext);

    res.json({
      success: true,
      message: 'Sync complete. Google API integration pending OAuth setup.',
      emailsProcessed: 0,
      eventsProcessed: 0,
      businessContext: businessContext.businessName,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync error:', error);
    res.status(500).json({ error: errorMsg });
  }
};
