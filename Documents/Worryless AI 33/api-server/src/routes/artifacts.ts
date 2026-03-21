import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

export const getArtifacts: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;

    const { rows } = await pool.query(
      'SELECT * FROM business_artifacts WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );

    res.json(rows);
  } catch (error) {
    console.error('[artifacts] getArtifacts error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createArtifact: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { artifact_type, content, metadata } = req.body as {
      artifact_type: string;
      content?: string;
      metadata?: unknown;
    };

    if (!artifact_type) {
      res.status(400).json({ error: 'artifact_type is required' });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO business_artifacts (user_id, artifact_type, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, artifact_type, content ?? null, metadata ? JSON.stringify(metadata) : null],
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('[artifacts] createArtifact error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteArtifact: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;
    const { id } = req.params;

    await pool.query(
      'DELETE FROM business_artifacts WHERE id = $1 AND user_id = $2',
      [id, userId],
    );

    res.status(204).send();
  } catch (error) {
    console.error('[artifacts] deleteArtifact error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
