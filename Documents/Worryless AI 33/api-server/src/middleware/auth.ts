import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import type { Request, Response, NextFunction } from 'express';

export interface AuthedRequest extends Request {
  auth?: { userId: string; payload: JWTPayload };
}

// Lazy-initialize JWKS so module import doesn't crash when LOGTO_ENDPOINT is unset (e.g. tests)
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!_jwks) {
    const endpoint = process.env.LOGTO_ENDPOINT;
    if (!endpoint) throw new Error('LOGTO_ENDPOINT environment variable is required');
    _jwks = createRemoteJWKSet(new URL(`${endpoint}/oidc/jwks`));
  }
  return _jwks;
}

function getIssuer() {
  return `${process.env.LOGTO_ENDPOINT}/oidc`;
}

export async function verifyLogtoJWT(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: getIssuer(),
    });
    if (!payload.sub) {
      res.status(401).json({ error: 'Token missing sub claim' });
      return;
    }
    req.auth = { userId: payload.sub, payload };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
