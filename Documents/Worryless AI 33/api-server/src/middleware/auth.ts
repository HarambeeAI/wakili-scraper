import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import type { Request, Response, NextFunction } from 'express';

const LOGTO_ENDPOINT = process.env.LOGTO_ENDPOINT!;
const JWKS_URI = `${LOGTO_ENDPOINT}/oidc/jwks`;
const ISSUER = `${LOGTO_ENDPOINT}/oidc`;

const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

export interface AuthedRequest extends Request {
  auth?: { userId: string; payload: JWTPayload };
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
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      // TODO: enable audience validation once frontend consistently passes resource
      // audience: process.env.LOGTO_API_RESOURCE,
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
