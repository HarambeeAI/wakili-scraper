import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getDatasheets: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { rows } = await pool.query(
      'SELECT * FROM datasheets WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    res.json(rows);
  } catch (error) {
    console.error('[datasheets] Get error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createDatasheet: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { name, content, parsed_data } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO datasheets (user_id, name, content, parsed_data)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, name, content, parsed_data],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[datasheets] Create error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteDatasheet: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { id } = req.params;
    await pool.query('DELETE FROM datasheets WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json({ status: 'deleted' });
  } catch (error) {
    console.error('[datasheets] Delete error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
