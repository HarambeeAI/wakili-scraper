import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// Mock pool (required by other routes imported in index.ts)
vi.mock('../db/pool.js', () => ({
  pool: { query: vi.fn() },
}));

// Mock gemini
vi.mock('../lib/gemini.js', () => ({
  getGeminiOpenAI: () => ({
    chat: { completions: { create: vi.fn() } },
  }),
}));

// Mock auth middleware
vi.mock('../middleware/auth.js', () => ({
  verifyLogtoJWT: vi.fn((_req: any, _res: any, next: any) => {
    _req.auth = { userId: 'test-user-123', payload: {} };
    next();
  }),
}));

import { app } from '../index.js';

describe('POST /api/langgraph-proxy', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sets Content-Type: text/event-stream', async () => {
    // Mock upstream response as a readable stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: stream,
    }) as any;

    const res = await request(app)
      .post('/api/langgraph-proxy')
      .send({ message: 'hello' });

    expect(res.headers['content-type']).toContain('text/event-stream');
  });

  it('sets X-Accel-Buffering: no header', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: stream,
    }) as any;

    const res = await request(app)
      .post('/api/langgraph-proxy')
      .send({ message: 'hello' });

    expect(res.headers['x-accel-buffering']).toBe('no');
  });

  it('sets Cache-Control: no-cache header', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: stream,
    }) as any;

    const res = await request(app)
      .post('/api/langgraph-proxy')
      .send({ message: 'hello' });

    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('pipes SSE chunks from upstream to response', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"type":"meta","agent":"accountant"}\n\n',
      'data: {"type":"delta","content":"Hello "}\n\n',
      'data: {"type":"delta","content":"world"}\n\n',
      'data: {"type":"done"}\n\n',
    ];

    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: stream,
    }) as any;

    const res = await request(app)
      .post('/api/langgraph-proxy')
      .send({ message: 'hello' });

    // Response body should contain the piped chunks
    expect(res.text).toContain('meta');
    expect(res.text).toContain('delta');
    expect(res.text).toContain('done');
  });

  it('sends error SSE when upstream returns non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: new Headers(),
      body: null,
    }) as any;

    const res = await request(app)
      .post('/api/langgraph-proxy')
      .send({ message: 'hello' });

    expect(res.text).toContain('Upstream error: 502');
  });

  it('forwards Authorization header to upstream', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: stream,
    });
    global.fetch = mockFetch as any;

    await request(app)
      .post('/api/langgraph-proxy')
      .set('Authorization', 'Bearer test-jwt-token')
      .send({ message: 'hello' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers['Authorization']).toBe('Bearer test-jwt-token');
  });
});
