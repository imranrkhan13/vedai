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

// aud separates token kinds: session tokens have no aud, WebSocket tickets use aud "ws" and live 60 seconds.
export function signToken(uid: string, ttlSeconds = 7 * 24 * 3600, aud?: string): string {
  const body = b64(JSON.stringify({ uid, aud, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = b64(crypto.createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken(token: string, aud?: string): string | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const want = crypto.createHmac('sha256', secret()).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if ((p.aud || undefined) !== aud) return null;
    if (typeof p.uid !== 'string' || typeof p.exp !== 'number' || p.exp < Date.now() / 1000) return null;
    return p.uid;
  } catch { return null; }
}

declare module 'express-serve-static-core' { interface Request { userId?: string } }

export const COOKIE = 'qx_session';
const WEEK = 7 * 24 * 3600;
const secureCookie = (req: Request) => process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true' || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

export function setSession(req: Request, res: Response, uid: string) {
  res.setHeader('Set-Cookie', `${COOKIE}=${signToken(uid)}; Max-Age=${WEEK}; Path=/; HttpOnly; SameSite=Lax${secureCookie(req) ? '; Secure' : ''}`);
}
export function clearSession(req: Request, res: Response) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secureCookie(req) ? '; Secure' : ''}`);
}
function cookieToken(req: Request): string | null {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

// Session comes from the httpOnly cookie (or a Bearer token for scripts). For cookie sessions, state-changing requests
// must carry the custom header X-Requested-With: quillix, which a cross-site form or image cannot send (CSRF defence, on top of SameSite=Lax).
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  let uid: string | null = null;
  if (h.startsWith('Bearer ')) uid = verifyToken(h.slice(7));
  else {
    const c = cookieToken(req);
    if (c) {
      uid = verifyToken(c);
      const safe = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
      if (uid && !safe && req.headers['x-requested-with'] !== 'quillix') return res.status(403).json({ success: false, error: 'Blocked request' });
    }
  }
  if (!uid) return res.status(401).json({ success: false, error: 'Please sign in' });
  req.userId = uid;
  next();
}
