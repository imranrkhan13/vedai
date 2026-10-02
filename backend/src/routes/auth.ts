import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../services/db';
import { hashPassword, verifyPassword, signToken, requireAuth, setSession, clearSession } from '../services/auth';

const router = Router();
const Creds = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(8).max(200) });

// Simple in-memory limiter: 10 attempts per hour per IP for register and login.
const hits = new Map<string, number[]>();
function limited(req: Request): boolean {
  const xf = String(req.headers['x-forwarded-for'] || req.ip || '').split(',').map((x) => x.trim());
  const ip = xf.length >= 2 ? xf[xf.length - 2] : xf[0];
  const em = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().slice(0, 200) : '';
  if (em && em !== 'x' && (() => { const k2 = `e:${em}:${req.path}`; const n = Date.now(); const a2 = (hits.get(k2) || []).filter((t) => n - t < 3600_000); if (a2.length >= Number(process.env.AUTH_LIMIT_PER_HOUR || 10)) return true; a2.push(n); hits.set(k2, a2); return false; })()) return true;
  const key = `${ip}:${req.path}`;
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 3600_000);
  if (arr.length >= Number(process.env.AUTH_LIMIT_PER_HOUR || 10)) return true;
  arr.push(now); hits.set(key, arr);
  return false;
}

router.post('/register', async (req: Request, res: Response) => {
  if (limited(req)) return res.status(429).json({ success: false, error: 'Too many attempts. Try again later.' });
  const p = Creds.safeParse(req.body);
  if (!p.success) return res.status(400).json({ success: false, error: 'Enter a valid email and a password of at least 8 characters' });
  try {
    const { rows } = await getDb().query(
      'INSERT INTO vedai_users (email, password_hash) VALUES ($1,$2) ON CONFLICT (email) DO NOTHING RETURNING id, email',
      [p.data.email, hashPassword(p.data.password)]
    );
    if (!rows[0]) return res.status(409).json({ success: false, error: 'That email is already registered' });
    setSession(req, res, rows[0].id);
    return res.status(201).json({ success: true, data: { user: { id: rows[0].id, email: rows[0].email } } });
  } catch { return res.status(500).json({ success: false, error: 'Could not register' }); }
});

router.post('/login', async (req: Request, res: Response) => {
  if (limited(req)) return res.status(429).json({ success: false, error: 'Too many attempts. Try again later.' });
  const p = Creds.safeParse(req.body);
  if (!p.success) return res.status(400).json({ success: false, error: 'Enter a valid email and password' });
  try {
    const { rows } = await getDb().query('SELECT id, email, password_hash FROM vedai_users WHERE email=$1', [p.data.email]);
    const u = rows[0];
    if (!u || !verifyPassword(p.data.password, u.password_hash)) return res.status(401).json({ success: false, error: 'Wrong email or password' });
    setSession(req, res, u.id);
    return res.json({ success: true, data: { user: { id: u.id, email: u.email } } });
  } catch { return res.status(500).json({ success: false, error: 'Could not sign in' }); }
});

router.post('/logout', (req: Request, res: Response) => { clearSession(req, res); res.json({ success: true, data: {} }); });

// Short-lived ticket so the browser can open the WebSocket (a cookie is not sent to the API host).
router.get('/ws-ticket', requireAuth, (req: Request, res: Response) => res.json({ success: true, data: { ticket: signToken(req.userId!, 60, 'ws') } }));

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const { rows } = await getDb().query('SELECT id, email FROM vedai_users WHERE id=$1', [req.userId]);
  if (!rows[0]) return res.status(401).json({ success: false, error: 'Please sign in' });
  return res.json({ success: true, data: rows[0] });
});

export default router;
