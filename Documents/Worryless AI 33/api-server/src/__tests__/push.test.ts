import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock web-push before importing the route
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  },
}));

// Mock the db pool
vi.mock('../db/pool.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import webpush from 'web-push';
import { sendPushNotification, createPushSubscription, deletePushSubscription } from '../routes/pushSubscriptions.js';

describe('Push subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendPushNotification', () => {
    it('calls webpush.sendNotification with correct args', async () => {
      const subscription = {
        endpoint: 'https://test.push.example',
        keys: { p256dh: 'key1', auth: 'key2' },
      };
      const payload = { title: 'Test', body: 'Hello' };

      await sendPushNotification(subscription, payload);

      expect(webpush.sendNotification).toHaveBeenCalledWith(
        { endpoint: 'https://test.push.example', keys: { p256dh: 'key1', auth: 'key2' } },
        JSON.stringify({ title: 'Test', body: 'Hello' }),
      );
    });
  });

  describe('createPushSubscription', () => {
    it('returns 400 when endpoint is missing', async () => {
      const req = {
        body: { keys: { p256dh: 'k1', auth: 'k2' } },
        auth: { userId: 'user-1' },
      } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      await createPushSubscription(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('endpoint') }),
      );
    });

    it('returns 400 when keys are missing', async () => {
      const req = {
        body: { endpoint: 'https://push.example' },
        auth: { userId: 'user-1' },
      } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      await createPushSubscription(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deletePushSubscription', () => {
    it('returns 400 when endpoint is missing', async () => {
      const req = {
        body: {},
        auth: { userId: 'user-1' },
      } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      await deletePushSubscription(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('endpoint') }),
      );
    });
  });
});
