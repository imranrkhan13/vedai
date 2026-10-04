// Consented single-student pilot. Jev endpoint MOCKED (no real network). Proves the gates, limits and per-paper checks, not grading quality.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-test-secret-test-secret';
process.env.JEV_ENABLED = 'true'; process.env.JEV_API_KEY = 'apikey_MOCK'; process.env.JEV_DEMO_USER_ID = 'demo-user'; process.env.JEV_MAX_PER_DAY = '1000';
const src = (f: string) => path.resolve(__dirname, '../src', f);
const stub = (f: string, exports: any) => { require.cache[require.resolve(src(f))] = { id: src(f), filename: src(f), loaded: true, exports } as any; };
let day = 0;
stub('services/redis.ts', { getRedis: () => ({ get: async () => null, setex: async () => 'OK', del: async () => 1, incr: async () => ++day, decr: async () => --day, expire: async () => 1 }) });
stub('services/queue.ts', { getAssignmentQueue: () => ({ add: async () => ({ id: '1' }) }) });
let usageMode: 'ok' | 'none' | 'huge' = 'ok'; const bodies: any[] = []; const realFetch = globalThis.fetch;
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
  const P1 = await mkPaper(1);
  let x = await go(P1, 'S1', 'adult', true, false, ['q1']); ok(bodies.length === 0 && !Object.keys(x.g.draft).length, 'adult+consent but NOT the named pilot student: nothing sent');
  x = await go(P1, 'S2', 'under18', true, true, ['q1']); ok(bodies.length === 0, 'under 18 even when named: nothing sent (consent also impossible)');
  x = await go(P1, 'S3', 'unknown', false, true, ['q1']); ok(bodies.length === 0, 'unknown age: nothing sent');
  x = await go(P1, 'S4', 'adult', false, true, ['q1']); ok(bodies.length === 0, 'adult named but no consent: nothing sent');
  x = await go(P1, 'S5', 'adult', true, true, ['q1']);
  ok(bodies.length === 4 && bodies.every((b) => b.state.student_answer === ANS), 'consented named adult: 1 score + 3 key-point check requests, each with only his own answer');
  ok(JSON.stringify(bodies[0]).indexOf('water vapour') < 0 && bodies.slice(1).every((b) => Object.keys(b.questions).join(',') === 'k' && b.questions.k.type === 'noul'), 'the score request carries no answer key text; each check is its OWN request with one yes/no question built from the teacher key');
  ok(bodies[0].questions.q.criteria.join('|') === 'LOW-LEVEL|MID-LEVEL|TOP-LEVEL', 'criteria come from this paper\'s own rubric, ascending');
  ok(Object.keys(bodies[0].questions).join(',') === 'q' && bodies[0].questions.q.type === 'score', 'the first request is a Score question alone, no yes/no checks inside it');
  const d = x.g.draft.q1; ok(d.state === 'done' && d.pilot === true && d.scoreOnly === false && d.marks === 2 && Array.isArray(d.checklist) && d.checklist.length === 3 && d.guideText === 'MID-LEVEL', 'draft stored: level marks, the teacher\'s own guide text and 3 key-point checks');
  ok(Object.keys(x.g.marks).length === 0 && x.g.released === false, 'draft is not marks and is not released');
  const me: any = await fetch(base + '/student/me', { headers: { Cookie: x.ck, 'X-Requested-With': 'quillix' } }).then((r) => r.json()); ok(!JSON.stringify(me).includes('TOP-LEVEL') && !JSON.stringify(me).includes('confidence') && me.data.student.aiPilot === true, 'student never sees draft or guide; pilot flag shown to the student');
  const cnt: any = (await pg.query("SELECT pilot_calls, pilot_cost_usd FROM vedai_students WHERE id=$1", [x.row])).rows[0]; ok(cnt.pilot_calls === 4 && Math.abs(cnt.pilot_cost_usd - 4 * 1200 * 0.042 / 1e6) < 1e-9, 'every reservation replaced by the real usage.input_tokens (4 requests x 1200 tokens)');
  // call cap: 8 questions, only 6 requests ever
  const before = bodies.length; const P8 = await mkPaper(8);
  x = await go(P8, 'S6', 'adult', true, true, ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']);
  ok(bodies.length - before === 6, 'hard cap: 8 eligible questions, exactly 6 requests');
  ok(Object.values(x.g.draft).filter((v: any) => v.state === 'done').length === 2 && Object.values(x.g.draft).filter((v: any) => v.state === 'failed').length === 6, 'q1 uses 4 requests (score + 3 checks), q2 uses the last 2 (score + 1 check); the other 6 questions say limit reached, mark by hand');
  // spend cap: row at 0.00999 -> blocked before any request
  const b2 = bodies.length; const P2 = await mkPaper(1);
  const r = await t('POST', `/roster/${P2}`, { studentId: 'S7', ageGroup: 'adult' }); const row7 = r.body.data.id; await pg.query('UPDATE vedai_students SET pilot_cost_usd=0.00999 WHERE id=$1', [row7]);
  const l = await fetch(base + '/student/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quillix' }, body: JSON.stringify({ studentId: 'S7', accessCode: r.body.data.accessCode }) }); const ck7 = (l.headers.get('set-cookie') || '').split(';')[0];
  const H7 = { 'Content-Type': 'application/json', 'X-Requested-With': 'quillix', Cookie: ck7 }; await fetch(base + '/student/consent', { method: 'POST', headers: H7, body: JSON.stringify({ agree: true }) }); process.env.REAL_ANSWER_AI_STUDENT = row7;
  await fetch(base + '/student/submit', { method: 'POST', headers: H7, body: JSON.stringify({ answers: { q1: ANS } }) }); await new Promise((z) => setTimeout(z, 300));
  const g7: any = (await t('GET', `/roster/${P2}/${row7}`)).body.data; ok(bodies.length === b2 && g7.draft.q1.state === 'failed', 'spend ceiling reached: no request is made');
  // too short answer / paper without a usable key
  const b3 = bodies.length; x = await go(P1, 'S8', 'adult', true, true, ['q1'], 'short'); ok(bodies.length === b3, 'too-short answer is not sent');
  // missing usage keeps the full documented reservation; usage above the reservation is recorded and blocks the next request
  { const { PILOT_RESERVE_USD } = await import('../src/services/jev'); ok(Math.abs(PILOT_RESERVE_USD - 0.002688) < 1e-9, 'reservation is the documented 64k tokens at $0.042 per million');
    usageMode = 'none'; const bN = bodies.length; const xN = await go(P1, 'S9', 'adult', true, true, ['q1']); const cN: any = (await pg.query('SELECT pilot_cost_usd FROM vedai_students WHERE id=$1', [xN.row])).rows[0];
    ok(bodies.length === bN + 3 && Math.abs(cN.pilot_cost_usd - 3 * PILOT_RESERVE_USD) < 1e-9, 'missing usage in the response: every full reservation stays counted, and the 4th request (4 x 0.002688 > 0.01) is refused');
    usageMode = 'huge'; const P3 = await mkPaper(3); const bH = bodies.length; const xH = await go(P3, 'S10', 'adult', true, true, ['q1', 'q2', 'q3']); const cH: any = (await pg.query('SELECT pilot_cost_usd, pilot_calls FROM vedai_students WHERE id=$1', [xH.row])).rows[0];
    ok(bodies.length - bH === 2 && cH.pilot_cost_usd > 0.0083 && cH.pilot_calls === 2, 'usage above the reservation is recorded as real cost, and the 3rd request is refused (real 0.0084 + reserve > 0.01)'); 
    const P4 = await mkPaper(1); const rr = await t('POST', `/roster/${P4}`, { studentId: 'S11', ageGroup: 'adult' }); await pg.query('UPDATE vedai_students SET pilot_cost_usd=0.0075 WHERE id=$1', [rr.body.data.id]); usageMode = 'ok';
    const l2 = await fetch(base + '/student/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quillix' }, body: JSON.stringify({ studentId: 'S11', accessCode: rr.body.data.accessCode }) }); const ck2 = (l2.headers.get('set-cookie') || '').split(';')[0]; const H2 = { 'Content-Type': 'application/json', 'X-Requested-With': 'quillix', Cookie: ck2 };
    await fetch(base + '/student/consent', { method: 'POST', headers: H2, body: JSON.stringify({ agree: true }) }); process.env.REAL_ANSWER_AI_STUDENT = rr.body.data.id; const bQ = bodies.length;
    await fetch(base + '/student/submit', { method: 'POST', headers: H2, body: JSON.stringify({ answers: { q1: ANS } }) }); await new Promise((z) => setTimeout(z, 300));
    ok(bodies.length === bQ, 'remaining budget below one documented maximum request: no request is started'); }
  ok(bodies.every((b) => b.model === 'jev-1.13.0'), 'only the Jev endpoint was called');
  console.log(`pilot tests passed: ${n}`); srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
