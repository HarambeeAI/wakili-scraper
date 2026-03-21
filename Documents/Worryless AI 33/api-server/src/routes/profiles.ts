import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getProfile: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;

    let { rows } = await pool.query('SELECT * FROM profiles WHERE id = $1', [userId]);

    if (rows.length === 0) {
      // Upsert-on-first-access: create default profile row
      await pool.query(
        'INSERT INTO profiles (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
        [userId],
      );
      const refetch = await pool.query('SELECT * FROM profiles WHERE id = $1', [userId]);
      rows = refetch.rows;
    }

    res.json(rows[0] ?? null);
  } catch (error) {
    console.error('[profiles] getProfile error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const updateProfile: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const body = req.body as Record<string, unknown>;

    const allowedColumns = [
      'business_name',
      'industry',
      'website_url',
      'business_stage',
      'onboarding_complete',
      'full_name',
      'email',
      'avatar_url',
      'phone',
      'address',
      'timezone',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of allowedColumns) {
      if (key in body) {
        updates.push(`${key} = $${idx}`);
        values.push(body[key]);
        idx++;
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    values.push(userId);
    const sql = `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const { rows } = await pool.query(sql, values);

    res.json(rows[0] ?? null);
  } catch (error) {
    console.error('[profiles] updateProfile error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
