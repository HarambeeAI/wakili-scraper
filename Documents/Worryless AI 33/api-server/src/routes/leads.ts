import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getLeads: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { rows } = await pool.query(
      'SELECT * FROM leads WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    res.json(rows);
  } catch (error) {
    console.error('[leads] Get error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createLead: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { name, email, company, status, source, notes } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO leads (user_id, name, email, company, status, source, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, name, email, company, status, source, notes],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[leads] Create error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteLead: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { id } = req.params;
    await pool.query('DELETE FROM leads WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json({ status: 'deleted' });
  } catch (error) {
    console.error('[leads] Delete error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
