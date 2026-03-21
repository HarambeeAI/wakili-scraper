import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getAgentAssets: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const agentType = req.query.agent_type as string | undefined;
    const { rows } = await pool.query(
      `SELECT * FROM agent_assets
       WHERE user_id = $1 AND agent_type = COALESCE($2, agent_type)
       ORDER BY created_at DESC`,
      [userId, agentType ?? null],
    );
    res.json(rows);
  } catch (error) {
    console.error('[agent-assets] Get error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
