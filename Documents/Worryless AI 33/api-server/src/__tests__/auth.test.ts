import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('Auth middleware', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).post('/api/spawn-agent-team');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Missing');
  });

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const res = await request(app)
      .post('/api/spawn-agent-team')
      .set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .post('/api/spawn-agent-team')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});
