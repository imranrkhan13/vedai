import { getRedis } from './redis';

// Demo-only client for TypeSafe Jev "Score" questions. Server-side only; the key never reaches the browser.

export interface JevScoreResult {
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
  model: string;
  nouls?: Record<string, number>;
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

export async function jevScore(state: Record<string, string>, instructions: string, criteria: string[], checks?: Record<string, string>): Promise<JevScoreResult> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const resp = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.JEV_API_KEY}` },
      body: JSON.stringify({ state, model: 'jev-1.13.0', questions: { q: { type: 'score', instructions, criteria }, ...Object.fromEntries(Object.entries(checks || {}).map(([k, v]) => [k, { type: 'noul', instructions: v }])) } }),
      signal: ctl.signal,
    });
    if (!resp.ok) throw new Error(`jev ${resp.status}`);
    const j: any = await resp.json();
    const a = j?.answers?.q;
    if (!a || a.type !== 'score' || typeof a.score !== 'number' || !a.probabilities) throw new Error('jev bad shape');
    const nouls: Record<string, number> = {};
    for (const k of Object.keys(checks || {})) { const x = j?.answers?.[k]; if (x && x.type === 'noul' && typeof x.noul === 'number') nouls[k] = x.noul; }
    return { score: a.score, confidence: Number(a.confidence), probabilities: a.probabilities, model: String(j.model || 'jev-1.13.0'), nouls };
  } finally {
    clearTimeout(t);
  }
}


// Server-fixed key points for the SYNTHETIC photosynthesis demo question. One yes/no (Noul) question each, asked in the same single request.
// The answer is only ever one of the fixed synthetic answers; these points are never built from user-typed text.
export const DEMO_KEY_POINTS: Record<string, string> = {
  k1: 'Does `student_answer` say that chlorophyll absorbs sunlight?',
  k2: 'Does `student_answer` say that the plant uses carbon dioxide?',
  k3: 'Does `student_answer` say that the plant uses water?',
  k4: 'Does `student_answer` say that carbon dioxide enters through the stomata?',
  k5: 'Does `student_answer` say that water comes up from the roots?',
  k6: 'Does `student_answer` say that the plant makes glucose?',
  k7: 'Does `student_answer` say that the plant releases oxygen?',
  k8: 'Does `student_answer` say that extra glucose is stored as starch?',
  k9: 'Does `student_answer` say that without sunlight the process slows or stops?',
};
export const DEMO_KEY_LABELS: Record<string, string> = {
  k1: 'Chlorophyll absorbs sunlight', k2: 'Uses carbon dioxide', k3: 'Uses water', k4: 'Carbon dioxide enters through the stomata', k5: 'Water comes up from the roots',
  k6: 'Makes glucose', k7: 'Releases oxygen', k8: 'Extra glucose stored as starch', k9: 'Slows or stops without sunlight',
};
export function checklist(nouls: Record<string, number> | undefined) {
  return Object.keys(DEMO_KEY_POINTS).map((k) => {
    const p = nouls && typeof nouls[k] === 'number' ? nouls[k] : null;
    return { point: DEMO_KEY_LABELS[k], p, status: p === null ? 'unknown' : p >= 0.7 ? 'covered' : p <= 0.3 ? 'not covered' : 'uncertain' };
  });
}
