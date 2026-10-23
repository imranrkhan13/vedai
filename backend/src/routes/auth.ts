import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../services/db';
import { hashPassword, verifyPassword, signToken, requireAuth, cookieOptions } from '../services/auth';

const router = Router();
const Creds = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(8).max(200) });

// Simple in-memory limiter: 10 attempts per hour per IP for register and login.
const hits = new Map<string, number[]>();
function limited(req: Request): boolean {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',').pop()!.trim();
  const key = `${ip}:${req.path}`;
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 3600_000);
  if (arr.length >= Number(process.env.AUTH_LIMIT_PER_HOUR || 10)) return true;
  arr.push(now); hits.set(key, arr);
  return false;
}

router.post('/register', (_req,res) => res.status(403).json({success:false,error:'Registration is by approval only. Join the waitlist or book a call.'}));

router.post('/login', async (req: Request, res: Response) => {
  if (limited(req)) return res.status(429).json({ success: false, error: 'Too many attempts. Try again later.' });
  const p = Creds.safeParse(req.body);
  if (!p.success) return res.status(400).json({ success: false, error: 'Enter a valid email and password' });
  try {
    const { rows } = await getDb().query('SELECT id, email, password_hash, access_approved FROM vedai_users WHERE email=$1', [p.data.email]);
    const u = rows[0];
    if (!u || !verifyPassword(p.data.password, u.password_hash)) return res.status(401).json({ success: false, error: 'Wrong email or password' });
    if (!u.access_approved) return res.status(403).json({success:false,error:'Access has not been approved. Please join the waitlist.'});
    res.cookie('vedai_session', signToken(u.id), cookieOptions);
    return res.json({ success: true, data: { token: signToken(u.id), user: { id: u.id, email: u.email } } });
  } catch { return res.status(500).json({ success: false, error: 'Could not sign in' }); }
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const { rows } = await getDb().query('SELECT id, email FROM vedai_users WHERE id=$1', [req.userId]);
  if (!rows[0]) return res.status(401).json({ success: false, error: 'Please sign in' });
  return res.json({ success: true, data: rows[0] });
});

router.post('/logout', (_req, res) => { res.clearCookie('vedai_session', { path: '/' }); res.json({ success: true }); });
router.get('/ws-ticket', requireAuth, (req, res) => res.json({ success: true, data: { ticket: signToken(req.userId!, 60, 'ws') } }));
export default router;
