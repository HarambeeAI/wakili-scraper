import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getUserAgents: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;

    const { rows } = await pool.query(
      `SELECT ua.*, aat.display_name, aat.description
       FROM user_agents ua
       JOIN available_agent_types aat ON ua.agent_type_id = aat.id
       WHERE ua.user_id = $1`,
      [userId],
    );

    res.json(rows);
  } catch (error) {
    console.error('[userAgents] getUserAgents error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createUserAgent: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { agent_type_id, is_active } = req.body as {
      agent_type_id: string;
      is_active?: boolean;
    };

    if (!agent_type_id) {
      res.status(400).json({ error: 'agent_type_id is required' });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO user_agents (user_id, agent_type_id, is_active)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, agent_type_id, is_active ?? true],
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[userAgents] createUserAgent error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const updateUserAgent: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    // :id here is the agent_type_id (per plan spec)
    const agentTypeId = req.params.id;
    const body = req.body as Record<string, unknown>;

    const allowedColumns = ['is_active', 'skill_config', 'tools_config'];

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

    values.push(agentTypeId, userId);
    const sql = `UPDATE user_agents SET ${updates.join(', ')} WHERE agent_type_id = $${idx} AND user_id = $${idx + 1} RETURNING *`;
    const { rows } = await pool.query(sql, values);

    if (rows.length === 0) {
      res.status(404).json({ error: 'User agent not found' });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('[userAgents] updateUserAgent error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getHeartbeatConfig: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { agentTypeId } = req.params;

    const { rows } = await pool.query(
      `SELECT heartbeat_enabled, heartbeat_interval_hours, heartbeat_time_ranges, last_heartbeat_at
       FROM user_agents
       WHERE agent_type_id = $1 AND user_id = $2`,
      [agentTypeId, userId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'User agent not found' });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('[userAgents] getHeartbeatConfig error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const updateHeartbeatConfig: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { agentTypeId } = req.params;
    const { heartbeat_enabled, heartbeat_interval_hours, heartbeat_time_ranges } = req.body as {
      heartbeat_enabled?: boolean;
      heartbeat_interval_hours?: number;
      heartbeat_time_ranges?: unknown;
    };

    const { rows } = await pool.query(
      `UPDATE user_agents
       SET heartbeat_enabled = $3, heartbeat_interval_hours = $4, heartbeat_time_ranges = $5
       WHERE agent_type_id = $1 AND user_id = $2
       RETURNING heartbeat_enabled, heartbeat_interval_hours, heartbeat_time_ranges, last_heartbeat_at`,
      [agentTypeId, userId, heartbeat_enabled, heartbeat_interval_hours, heartbeat_time_ranges],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'User agent not found' });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('[userAgents] updateHeartbeatConfig error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getCadenceConfig: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { agentTypeId } = req.params;

    const { rows } = await pool.query(
      `SELECT cadence_config
       FROM user_agents
       WHERE agent_type_id = $1 AND user_id = $2`,
      [agentTypeId, userId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'User agent not found' });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('[userAgents] getCadenceConfig error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const updateCadenceConfig: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { agentTypeId } = req.params;
    const { cadence_config } = req.body as { cadence_config: unknown };

    const { rows } = await pool.query(
      `UPDATE user_agents
       SET cadence_config = $3
       WHERE agent_type_id = $1 AND user_id = $2
       RETURNING cadence_config`,
      [agentTypeId, userId, cadence_config],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'User agent not found' });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('[userAgents] updateCadenceConfig error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
