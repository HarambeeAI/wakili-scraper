import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getInvoices: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { rows } = await pool.query(
      'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    res.json(rows);
  } catch (error) {
    console.error('[invoices] Get error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createInvoice: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { client_name, amount, currency, status, due_date, items } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO invoices (user_id, client_name, amount, currency, status, due_date, items)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, client_name, amount, currency, status, due_date, items],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[invoices] Create error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteInvoice: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { id } = req.params;
    await pool.query('DELETE FROM invoices WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json({ status: 'deleted' });
  } catch (error) {
    console.error('[invoices] Delete error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
