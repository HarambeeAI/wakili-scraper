import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getTeamData: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;

    const { rows } = await pool.query(
      `SELECT
        ua.agent_type_id,
        ua.is_active,
        aat.display_name,
        aat.description,
        (
          SELECT MAX(ahl.created_at)
          FROM agent_heartbeat_log ahl
          WHERE ahl.agent_type_id = ua.agent_type_id
            AND ahl.user_id = ua.user_id
        ) AS last_heartbeat_at,
        (
          SELECT outcome
          FROM agent_heartbeat_log ahl
          WHERE ahl.agent_type_id = ua.agent_type_id
            AND ahl.user_id = ua.user_id
          ORDER BY ahl.created_at DESC
          LIMIT 1
        ) AS last_heartbeat_outcome
      FROM user_agents ua
      JOIN available_agent_types aat ON ua.agent_type_id = aat.id
      WHERE ua.user_id = $1
        AND ua.is_active = true`,
      [userId],
    );

    res.json(rows);
  } catch (error) {
    console.error('[teamData] getTeamData error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
