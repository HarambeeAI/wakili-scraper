import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getOutreachEmails: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { rows } = await pool.query(
      'SELECT * FROM outreach_emails WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    res.json(rows);
  } catch (error) {
    console.error('[outreach-emails] Get error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createOutreachEmail: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { lead_id, subject, body, status } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO outreach_emails (user_id, lead_id, subject, body, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, lead_id, subject, body, status],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[outreach-emails] Create error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
