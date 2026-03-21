import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getWorkspace: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { agentTypeId, fileType } = req.params;

    const { rows } = await pool.query(
      `SELECT * FROM agent_workspaces
       WHERE user_id = $1 AND agent_type_id = $2 AND file_type = $3`,
      [userId, agentTypeId, fileType],
    );

    res.json(rows[0] ?? null);
  } catch (error) {
    console.error('[workspaces] getWorkspace error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const updateWorkspace: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { agentTypeId, fileType } = req.params;
    const { content } = req.body as { content: string };

    if (content === undefined) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const { rows } = await pool.query(
      `UPDATE agent_workspaces
       SET content = $4, updated_at = NOW()
       WHERE user_id = $1 AND agent_type_id = $2 AND file_type = $3
       RETURNING *`,
      [userId, agentTypeId, fileType, content],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('[workspaces] updateWorkspace error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
