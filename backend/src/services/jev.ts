import { getRedis } from './redis';

// Demo-only client for TypeSafe Jev "Score" questions. Server-side only; the key never reaches the browser.

export interface JevScoreResult {
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
  model: string;
}

export function jevEnabled(): boolean {
  return process.env.JEV_ENABLED === 'true' && !!process.env.JEV_API_KEY && !!process.env.JEV_DEMO_USER_ID && !!process.env.JEV_DEMO_ASSIGNMENT_ID;
}

// Server-fixed SYNTHETIC answers (photosynthesis demo passage). No user-typed text is ever sent to Jev.
export const JEV_FIXTURES: Record<string, string> = {
  full: 'SYNTHETIC TEST Chlorophyll in the chloroplasts of the leaf absorbs sunlight. Carbon dioxide enters through the stomata and water comes up from the roots. The plant turns carbon dioxide and water into glucose and releases oxygen. Extra glucose is stored as starch, and without sunlight the process slows and stops.',
  partial: 'SYNTHETIC TEST Chlorophyll absorbs sunlight and the plant uses carbon dioxide and water to make glucose. Oxygen is released.',
  weak: 'SYNTHETIC TEST Plants use sunlight and water to grow. They need light.',
};

export const JEV_MAX_PER_PAPER = Number(process.env.JEV_MAX_PER_PAPER || 4);
export const JEV_MAX_PER_DAY = Number(process.env.JEV_MAX_PER_DAY || 15);

// Hard app-wide daily cap (Redis counter). Returns false when the cap is reached.
export async function takeDailySlot(): Promise<boolean> {
  const key = `jev:day:${new Date().toISOString().slice(0, 10)}`;
  const r = getRedis();
  const n = await r.incr(key);
  if (n === 1) await r.expire(key, 60 * 60 * 30);
  if (n > JEV_MAX_PER_DAY) { await r.decr(key); return false; }
  return true;
}

export async function jevScore(state: Record<string, string>, instructions: string, criteria: string[]): Promise<JevScoreResult> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const resp = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.JEV_API_KEY}` },
      body: JSON.stringify({ state, model: 'jev-1.13.0', questions: { q: { type: 'score', instructions, criteria } } }),
      signal: ctl.signal,
    });
    if (!resp.ok) throw new Error(`jev ${resp.status}`);
    const j: any = await resp.json();
    const a = j?.answers?.q;
    if (!a || a.type !== 'score' || typeof a.score !== 'number' || !a.probabilities) throw new Error('jev bad shape');
    return { score: a.score, confidence: Number(a.confidence), probabilities: a.probabilities, model: String(j.model || 'jev-1.13.0') };
  } finally {
    clearTimeout(t);
  }
}
