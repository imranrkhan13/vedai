import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

// Self-hosted auth: scrypt password hashes and HMAC-signed tokens, using only Node's built-in crypto.
// The signing key comes from AUTH_SECRET if set, else it is derived from DATABASE_URL (a server-only secret).
function secret(): Buffer {
  const s = process.env.AUTH_SECRET || `vedai-auth:${process.env.DATABASE_URL || 'dev-only-secret'}`;
  return crypto.createHash('sha256').update(s).digest();
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const h = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
  const want = Buffer.from(hashHex, 'hex');
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function signToken(uid: string, ttlSeconds = 7 * 24 * 3600): string {
  const body = b64(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = b64(crypto.createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken(token: string): string | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const want = crypto.createHmac('sha256', secret()).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof p.uid !== 'string' || typeof p.exp !== 'number' || p.exp < Date.now() / 1000) return null;
    return p.uid;
  } catch { return null; }
}

declare module 'express-serve-static-core' { interface Request { userId?: string } }

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  const uid = h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
  if (!uid) return res.status(401).json({ success: false, error: 'Please sign in' });
  req.userId = uid;
  next();
}
