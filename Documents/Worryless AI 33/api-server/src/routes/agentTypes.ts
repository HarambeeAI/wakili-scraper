import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getAgentTypes: RequestHandler = async (req, res) => {
  try {
    // Suppress unused variable warning — auth is required via middleware but userId not needed here
    void (req as AuthedRequest).auth!.userId;

    const { rows } = await pool.query(
      'SELECT * FROM available_agent_types ORDER BY display_name',
    );

    res.json(rows);
  } catch (error) {
    console.error('[agentTypes] getAgentTypes error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
