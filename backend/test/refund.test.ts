// Refund-on-daily-cap-denial regression. Everything mocked, no network.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-test-secret-test-secret';
process.env.JEV_ENABLED = 'true'; process.env.JEV_API_KEY = 'apikey_MOCK'; process.env.JEV_DEMO_USER_ID = 'demo-user'; process.env.JEV_MAX_PER_DAY = '1';
const src = (f: string) => path.resolve(__dirname, '../src', f);
const stub = (f: string, exports: any) => { require.cache[require.resolve(src(f))] = { id: src(f), filename: src(f), loaded: true, exports } as any; };
let day = 0;
stub('services/redis.ts', { getRedis: () => ({ get: async () => null, setex: async () => 'OK', del: async () => 1, incr: async () => ++day, decr: async () => --day, expire: async () => 1 }) });
stub('services/queue.ts', { getAssignmentQueue: () => ({ add: async () => ({ id: '1' }) }) });
let usageMode: string = 'ok'; const bodies: any[] = []; const realFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string, init: any) => {
  if (String(url).startsWith('http://127.0.0.1')) return realFetch(url, init);
  if (String(url) === 'https://api.typesafe.ai/v1/systemone') {
    const body = JSON.parse(init.body); bodies.push(body);
    const ans: any = { q: { type: 'score', score: 1, confidence: 0.9, probabilities: { '0': 0.05, '1': 0.9, '2': 0.05 } } };
    Object.keys(body.questions).filter((k) => k !== 'q').forEach((k, i) => { ans[k] = { type: 'noul', noul: i === 0 ? 0.95 : 0.1 }; });
    return new Response(JSON.stringify({ model: 'jev-1.13.0', answers: ans, ...(usageMode === 'none' ? {} : { usage: { input_tokens: usageMode === 'huge' ? 100000 : 1200, output_tokens: 20 } }) }), { status: 200 });
  }
  throw new Error('unexpected outbound fetch ' + url);
};
(async () => {
  const { setDb, SCHEMA_SQL } = await import('../src/services/db');
  const pg = new PGlite(); await pg.exec(SCHEMA_SQL);
  setDb({ query: async (t, p) => { const r = await pg.query(t, p as any[]); return { rows: r.rows as any[], rowCount: r.affectedRows ?? r.rows.length }; } });
  const { Assignment } = await import('../src/models/Assignment');
  const { teacherRoster, studentPortal } = await import('../src/routes/roster');
  const { signToken } = await import('../src/services/auth');
  const app = express(); app.use(express.json()); app.use('/api/roster', teacherRoster); app.use('/api/student', studentPortal);
  const srv = app.listen(0); const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api`;
  let n = 0; const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };
  const t = async (method: string, p: string, body?: any) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signToken('teach') }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.json() as any }; };
  const rub = [{ marks: 4, descriptor: 'TOP-LEVEL', example: 'e' }, { marks: 2, descriptor: 'MID-LEVEL', example: 'e' }, { marks: 0, descriptor: 'LOW-LEVEL', example: 'e' }];
  const KEY = 'Rain forms when water vapour condenses around dust. Clouds hold the droplets until they grow heavy; gravity then pulls them down.';
  const mkPaper = async (nq: number) => { const a = await Assignment.create({ title: 'Pilot paper', subject: 'S', dueDate: '2099-12-31', questionTypes: ['Short'], numberOfQuestions: nq, totalMarks: 4 * nq, difficulty: 'mixed' } as any, 'teach');
    await Assignment.setCompleted(a._id, { subject: 'S', totalMarks: 4 * nq, generatedAt: new Date(), sections: [{ title: 'A', instruction: '', totalMarks: 4 * nq, questions: Array.from({ length: nq }, (_, i) => ({ id: 'q' + (i + 1), text: 'How does rain form? ' + (i + 1), difficulty: 'easy', marks: 4, type: 'Short', answer: KEY, rubric: rub })) }] } as any); return a._id as string; };
  const ANS = 'My own words: warm air rises, the vapour cools and turns into droplets on dust, and clouds get heavy so rain falls.';
  const go = async (P: string, sid: string, age: string, consent: boolean, pilot: boolean, qs: string[], answer = ANS) => {
    const r = await t('POST', `/roster/${P}`, { studentId: sid, ageGroup: age }); const code = r.body.data.accessCode, row = r.body.data.id;
    const l = await fetch(base + '/student/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quillix' }, body: JSON.stringify({ studentId: sid, accessCode: code }) }); const ck = (l.headers.get('set-cookie') || '').split(';')[0];
    const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'quillix', Cookie: ck };
    if (consent) await fetch(base + '/student/consent', { method: 'POST', headers: H, body: JSON.stringify({ agree: true }) });
    if (pilot) process.env.REAL_ANSWER_AI_STUDENT = row; else delete process.env.REAL_ANSWER_AI_STUDENT;
    const ans: Record<string, string> = {}; qs.forEach((q) => (ans[q] = answer));
    const sub = await fetch(base + '/student/submit', { method: 'POST', headers: H, body: JSON.stringify({ answers: ans }) }); ok(sub.status === 201, 'submitted');
    for (let i = 0; i < 60; i++) { const d = ((await pg.query('SELECT draft FROM vedai_submissions WHERE student_row_id=$1', [row])).rows[0] as any).draft; if (!Object.values(d).some((x: any) => x.state === 'pending')) break; await new Promise((z) => setTimeout(z, 50)); }
    const g: any = (await t('GET', `/roster/${P}/${row}`)).body.data; return { g, row, ck, H };
  };
  const { PILOT_RESERVE_USD, estCostUsd } = await import('../src/services/jev');
  // Case 1: daily cap = 1. Score request takes the only slot; the first check is denied and must be refunded.
  day = 0; const P1 = await mkPaper(1); const b0 = bodies.length;
  const x = await go(P1, 'R1', 'adult', true, true, ['q1']);
  const c1: any = (await pg.query('SELECT pilot_calls, pilot_cost_usd FROM vedai_students WHERE id=$1', [x.row])).rows[0];
  ok(bodies.length - b0 === 1, 'exactly one outbound request when the cap is 1');
  ok(c1.pilot_calls === 1, 'denied check slot was refunded: pilot_calls is 1, not 2 (got ' + c1.pilot_calls + ')');
  ok(Math.abs(c1.pilot_cost_usd - estCostUsd(1200)) < 1e-9, 'denied slot reservation refunded: cost is only the real 1200 tokens (got ' + c1.pilot_cost_usd + ')');
  ok(day === 1, 'daily counter is back at the cap, not above it');
  // Case 2: cap already used up. The score request is denied and refunded, no outbound request.
  const P2 = await mkPaper(1); const b1 = bodies.length;
  const y = await go(P2, 'R2', 'adult', true, true, ['q1']);
  const c2: any = (await pg.query('SELECT pilot_calls, pilot_cost_usd FROM vedai_students WHERE id=$1', [y.row])).rows[0];
  ok(bodies.length === b1, 'no outbound request once the cap is reached');
  ok(c2.pilot_calls === 0 && Number(c2.pilot_cost_usd) === 0, 'denied score slot refunded to 0 calls / $0 (got ' + c2.pilot_calls + ', ' + c2.pilot_cost_usd + ')');
  ok(PILOT_RESERVE_USD > 0, 'reservation non-zero');
  console.log(`refund regression passed: ${n}`); srv.close(); process.exit(0);
})().catch((e: any) => { console.error(e); process.exit(1); });
