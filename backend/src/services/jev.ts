import { getRedis } from './redis';

// Demo-only client for TypeSafe Jev "Score" questions. Server-side only; the key never reaches the browser.

export interface JevScoreResult {
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
  model: string;
  nouls?: Record<string, number>;
  usageInputTokens?: number;
}

export function jevKeyReady(): boolean { return process.env.JEV_ENABLED === 'true' && !!process.env.JEV_API_KEY; }
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

export function jevBody(state: Record<string, string>, instructions: string, criteria: string[], checks?: Record<string, string>) {
  return { state, model: 'jev-1.13.0', questions: { q: { type: 'score', instructions, criteria }, ...Object.fromEntries(Object.entries(checks || {}).map(([k, v]) => [k, { type: 'noul', instructions: v }])) } };
}
export async function jevScore(state: Record<string, string>, instructions: string, criteria: string[], checks?: Record<string, string>): Promise<JevScoreResult> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const resp = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.JEV_API_KEY}` },
      body: JSON.stringify(jevBody(state, instructions, criteria, checks)),
      signal: ctl.signal,
    });
    if (!resp.ok) throw new Error(`jev ${resp.status}`);
    const j: any = await resp.json();
    const a = j?.answers?.q;
    if (!a || a.type !== 'score' || typeof a.score !== 'number' || !a.probabilities) throw new Error('jev bad shape');
    const nouls: Record<string, number> = {};
    for (const k of Object.keys(checks || {})) { const x = j?.answers?.[k]; if (x && x.type === 'noul' && typeof x.noul === 'number') nouls[k] = x.noul; }
    const ut = Number(j?.usage?.input_tokens);
    return { score: a.score, confidence: Number(a.confidence), probabilities: a.probabilities, model: String(j.model || 'jev-1.13.0'), nouls, usageInputTokens: Number.isFinite(ut) && ut >= 0 ? ut : undefined };
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


// ---- Consented single-student pilot helpers ----
// Price source: https://docs.typesafe.ai/models.md ($0.042 per million input tokens, output free). The estimate below OVER-counts (1 token per 2 characters)
// so the enforced ceiling is conservative. The ceiling is enforced before every request, not just estimated afterwards.
export const PILOT_PRICE_PER_TOKEN = 0.042 / 1_000_000;
export const PILOT_MAX_CALLS = Math.min(6, Number(process.env.PILOT_MAX_CALLS || 6));
export const PILOT_MAX_USD = Math.min(0.01, Number(process.env.PILOT_MAX_USD || 0.01));
// Reservation per request = the DOCUMENTED per-request input limit (https://docs.typesafe.ai/models.md: 64k tokens per request) at the list price.
// It is reserved before every call and replaced by the real usage.input_tokens from the response (https://docs.typesafe.ai/api.md). If usage is missing or the call fails,
// the full reservation stays counted. Open question (not provider-confirmed): whether usage for a multi-question request can exceed the 64k context limit.
export const PILOT_MAX_TOKENS_PER_REQUEST = 64000;
export const PILOT_RESERVE_USD = PILOT_MAX_TOKENS_PER_REQUEST * PILOT_PRICE_PER_TOKEN;
export function estCostUsd(tokens: number): number { return tokens * PILOT_PRICE_PER_TOKEN; }

// Key points come from THIS paper's own answer key (teacher-side text), never from the student's words. Max 6 yes/no checks.
export function keyPointsFromKey(key: string): { checks: Record<string, string>; labels: Record<string, string> } {
  const parts = String(key || '').split(/[.;\n]+/).map((x) => x.trim().replace(/\s+/g, ' ')).filter((x) => x.length >= 12 && x.length <= 200);
  const seen = new Set<string>(); const checks: Record<string, string> = {}; const labels: Record<string, string> = {};
  for (const t of parts) {
    const k = t.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
    const id = `k${Object.keys(checks).length + 1}`; if (Object.keys(checks).length >= 6) break;
    checks[id] = `Does \`student_answer\` make this point: "${t.replace(/"/g, "'")}"?`; labels[id] = t;
  }
  return { checks, labels };
}
export function checklistFrom(labels: Record<string, string>, nouls: Record<string, number> | undefined) {
  return Object.keys(labels).map((k) => {
    const p = nouls && typeof nouls[k] === 'number' ? nouls[k] : null;
    return { point: labels[k], p, status: p === null ? 'unknown' : p >= 0.7 ? 'covered' : p <= 0.3 ? 'not covered' : 'uncertain' };
  });
}

// One yes/no (Noul) question as its OWN request (pilot: one question per request). Returns the model-reported likelihood and real billed input tokens.
export async function jevNoulOne(state: Record<string, string>, instruction: string): Promise<{ p: number; usageInputTokens?: number }> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const resp = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.JEV_API_KEY}` },
      body: JSON.stringify({ state, model: 'jev-1.13.0', questions: { k: { type: 'noul', instructions: instruction } } }), signal: ctl.signal });
    if (!resp.ok) throw new Error(`jev ${resp.status}`);
    const j: any = await resp.json(); const x = j?.answers?.k;
    if (!x || x.type !== 'noul' || typeof x.noul !== 'number') throw new Error('jev bad shape');
    const ut = Number(j?.usage?.input_tokens);
    return { p: x.noul, usageInputTokens: Number.isFinite(ut) && ut >= 0 ? ut : undefined };
  } finally { clearTimeout(t); }
}
