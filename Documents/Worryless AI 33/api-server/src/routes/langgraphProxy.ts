import type { RequestHandler } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';

const LANGGRAPH_URL = process.env.LANGGRAPH_SERVER_URL!;

export const langgraphProxy: RequestHandler = async (req, res) => {
  // SSE headers -- MUST be set before any data is written
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // CRITICAL: disables Railway/nginx buffering
  res.flushHeaders(); // CRITICAL: sends headers immediately

  // Strip /api/langgraph-proxy prefix to get the target path on the LangGraph server
  // e.g., /api/langgraph-proxy/invoke/stream -> /invoke/stream
  const targetPath = req.path.replace(/^\/api\/langgraph-proxy/, '') || '/invoke';
  const targetUrl = `${(LANGGRAPH_URL || process.env.LANGGRAPH_SERVER_URL || '').replace(/\/$/, '')}${targetPath}`;

  const userId = (req as AuthedRequest).auth?.userId;

  try {
    // Build forwarded body — inject user_id from JWT
    let forwardBody: string | undefined;
    if (req.method !== 'GET' && req.body) {
      const body = { ...req.body };
      if (userId) body.user_id = userId;
      forwardBody = JSON.stringify(body);
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization!, // Forward JWT -- LangGraph server also validates
      },
      body: forwardBody,
    });

    if (!upstream.ok) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: `Upstream error: ${upstream.status}` })}\n\n`);
      res.end();
      return;
    }

    if (!upstream.body) {
      res.end();
      return;
    }

    // Check if upstream is SSE or regular JSON
    const contentType = upstream.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream') || contentType.includes('application/json')) {
      // Pipe stream chunk by chunk -- NEVER buffer the entire response
      const reader = (upstream.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        res.end();
      }
    } else {
      // Non-streaming response -- wrap in SSE format
      const text = await upstream.text();
      res.write(`data: ${text}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('[langgraph-proxy] Upstream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' })}\n\n`);
    res.end();
  }
};
