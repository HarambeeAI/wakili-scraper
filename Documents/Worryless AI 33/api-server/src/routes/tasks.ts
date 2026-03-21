import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getTasks: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;

    const { rows } = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );

    res.json(rows);
  } catch (error) {
    console.error('[tasks] getTasks error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createTask: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { title, description, status, agent_type_id } = req.body as {
      title: string;
      description?: string;
      status?: string;
      agent_type_id?: string;
    };

    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO tasks (user_id, title, description, status, agent_type_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, title, description ?? null, status ?? 'pending', agent_type_id ?? null],
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[tasks] createTask error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const updateTask: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;

    const allowedColumns = ['title', 'description', 'status', 'completed_at'];

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

    values.push(id, userId);
    const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`;
    const { rows } = await pool.query(sql, values);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('[tasks] updateTask error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteTask: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { id } = req.params;

    await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
      [id, userId],
    );

    res.status(204).send();
  } catch (error) {
    console.error('[tasks] deleteTask error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
