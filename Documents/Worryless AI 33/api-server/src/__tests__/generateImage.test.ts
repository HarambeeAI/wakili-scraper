import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';

// Mock the geminiImage module before importing the handler
vi.mock('../lib/geminiImage.js', () => ({
  generateImageImagen3: vi.fn().mockResolvedValue('data:image/png;base64,TESTBASE64DATA'),
}));

import { generateImage } from '../routes/generateImage.js';
import { generateImageImagen3 } from '../lib/geminiImage.js';

function mockReqRes(body: Record<string, unknown>) {
  const req = {
    body,
    auth: { userId: 'test-user-id', payload: {} },
    headers: {},
  } as unknown as AuthedRequest;

  const resData: { statusCode: number; body: unknown } = { statusCode: 200, body: null };
  const res = {
    json: vi.fn((data: unknown) => {
      resData.body = data;
      return res;
    }),
    status: vi.fn((code: number) => {
      resData.statusCode = code;
      return res;
    }),
  } as unknown as Response;

  return { req, res, resData };
}

describe('POST /api/generate-image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns imageUrl as data URI on success', async () => {
    const { req, res, resData } = mockReqRes({ prompt: 'a sunset over mountains' });

    await generateImage(req, res, vi.fn());

    expect(generateImageImagen3).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledOnce();
    const body = resData.body as { imageUrl: string; description: string };
    expect(body.imageUrl).toBe('data:image/png;base64,TESTBASE64DATA');
    expect(body).toHaveProperty('description');
  });

  it('includes business context in the prompt when provided', async () => {
    const { req, res } = mockReqRes({
      prompt: 'product launch',
      businessContext: 'Tech startup selling SaaS',
    });

    await generateImage(req, res, vi.fn());

    const calledPrompt = (generateImageImagen3 as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledPrompt).toContain('Brand context: Tech startup selling SaaS');
  });

  it('returns 500 when image generation fails', async () => {
    (generateImageImagen3 as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Imagen 3 quota exceeded'),
    );

    const { req, res, resData } = mockReqRes({ prompt: 'fail case' });

    await generateImage(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect((resData.body as { error: string }).error).toBe('Imagen 3 quota exceeded');
  });
});
