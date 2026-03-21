import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getTransactions: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { rows } = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC',
      [userId],
    );
    res.json(rows);
  } catch (error) {
    console.error('[transactions] Get error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createTransaction: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { description, amount, category, date, type } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO transactions (user_id, description, amount, category, date, type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, description, amount, category, date, type],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[transactions] Create error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
