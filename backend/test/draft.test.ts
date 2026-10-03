// Auto AI draft test: in-memory Postgres, stubbed Redis, Jev endpoint MOCKED (no real network). Proves the scope guards, not Jev accuracy.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';

process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-test-secret-test-secret';
process.env.JEV_ENABLED = 'true'; process.env.JEV_API_KEY = 'apikey_MOCK'; process.env.JEV_DEMO_USER_ID = 'demo-user';
const src = (f: string) => path.resolve(__dirname, '../src', f);
const stub = (f: string, exports: any) => { require.cache[require.resolve(src(f))] = { id: src(f), filename: src(f), loaded: true, exports } as any; };
let day = 0;
stub('services/redis.ts', { getRedis: () => ({ get: async () => null, setex: async () => 'OK', del: async () => 1, incr: async () => ++day, decr: async () => --day, expire: async () => 1 }) });
stub('services/queue.ts', { getAssignmentQueue: () => ({ add: async () => ({ id: '1' }) }) });

const jevBodies: any[] = []; let jevMode: 'ok' | 'fail' = 'ok';
const realFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string, init: any) => {
  if (String(url).startsWith('http://127.0.0.1')) return realFetch(url, init);
  if (String(url) === 'https://api.typesafe.ai/v1/systemone') {
    jevBodies.push(JSON.parse(init.body));
    if (jevMode === 'fail') return new Response('{}', { status: 500 });
    const body = JSON.parse(init.body); const ans: any = { q: { type: 'score', score: 2, confidence: 0.8, probabilities: { '0': 0.05, '1': 0.1, '2': 0.85 } } }; const pv: Record<string, number> = { k1: 0.95, k2: 0.5, k3: 0.1 }; for (const k of Object.keys(body.questions)) if (k !== 'q' && k in pv) ans[k] = { type: 'noul', noul: pv[k] }; return new Response(JSON.stringify({ model: 'jev-1.13.0', answers: ans }), { status: 200 });
  }
  throw new Error('unexpected outbound fetch ' + url);
};

(async () => {
  const { setDb, SCHEMA_SQL } = await import('../src/services/db');
  const pg = new PGlite(); await pg.exec(SCHEMA_SQL);
  setDb({ query: async (t, p) => { const r = await pg.query(t, p as any[]); return { rows: r.rows as any[], rowCount: r.affectedRows ?? r.rows.length }; } });
  const { Assignment } = await import('../src/models/Assignment');
  const { teacherRoster, studentPortal } = await import('../src/routes/roster');
  const { JEV_FIXTURES } = await import('../src/services/jev');
  const { signToken } = await import('../src/services/auth');
  const app = express(); app.use(express.json()); app.use('/api/roster', teacherRoster); app.use('/api/student', studentPortal);
  const srv = app.listen(0); const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api`;
  let n = 0; const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };
  const t = async (tok: string, method: string, p: string, body?: any) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signToken(tok) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.json() as any }; };
  const mk = async (owner: string, text = 'Explain photosynthesis') => {
    const a = await Assignment.create({ title: 'SYNTHETIC TEST', subject: 'S', dueDate: '2099-12-31', questionTypes: ['Long'], numberOfQuestions: 1, totalMarks: 5, difficulty: 'mixed' } as any, owner);
    await Assignment.setCompleted(a._id, { subject: 'S', totalMarks: 5, generatedAt: new Date(), sections: [{ title: 'A', instruction: '', totalMarks: 5, questions: [
      { id: 'q1', text, difficulty: 'easy', marks: 5, type: 'Long', answer: 'k', rubric: [{ marks: 5, descriptor: 'FULL-GUIDE', example: 'e' }, { marks: 3, descriptor: 'MID-GUIDE', example: 'e' }, { marks: 0, descriptor: 'LOW-GUIDE', example: 'e' }] }] }] } as any);
    return a._id;
  };
  // returns {draft, marks} after student submits `answer`
  const run = async (owner: string, paper: string, sid: string, answer: string) => {
    let r: any = await t(owner, 'POST', `/roster/${paper}`, { studentId: sid }); const code = r.body.data.accessCode as string, row = r.body.data.id as string;
    const l = await fetch(base + '/student/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quillix' }, body: JSON.stringify({ studentId: sid, accessCode: code }) });
    const ck = (l.headers.get('set-cookie') || '').split(';')[0];
    const sub = await fetch(base + '/student/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quillix', Cookie: ck }, body: JSON.stringify({ answers: { q1: answer } }) });
    ok(sub.status === 201, 'submission saved');
    for (let i = 0; i < 40; i++) { const d = ((await pg.query('SELECT draft FROM vedai_submissions WHERE student_row_id=$1', [row])).rows[0] as any).draft; if (!Object.values(d).some((x: any) => x.state === 'pending')) break; await new Promise((z) => setTimeout(z, 50)); }
    const g: any = await t(owner, 'GET', `/roster/${paper}/${row}`);
    const me = await fetch(base + '/student/me', { headers: { Cookie: ck, 'X-Requested-With': 'quillix' } }).then((x) => x.json()) as any;
    return { g: g.body.data, me, row };
  };

  const P = await mk('demo-user');
  process.env.JEV_DEMO_ASSIGNMENT_ID = P;
  // 1 arbitrary text on the demo paper -> never sent
  let x = await run('demo-user', P, 'A1', 'my own typed answer about plants');
  ok(jevBodies.length === 0 && Object.keys(x.g.draft).length === 0, 'arbitrary typed answer is never sent, no draft');
  // 2 fixture on demo paper -> draft
  x = await run('demo-user', P, 'A2', JEV_FIXTURES.full);
  ok(jevBodies.length === 1 && jevBodies[0].state.student_answer === JEV_FIXTURES.full, 'exact synthetic answer sent once');
  ok(jevBodies[0].questions.q.criteria.join('|') === 'LOW-GUIDE|MID-GUIDE|FULL-GUIDE', 'criteria sent in ascending marks order');
  const d = x.g.draft.q1; ok(d.state === 'done' && d.marks === 5 && d.guideText === 'FULL-GUIDE' && d.confidence === 0.8, 'draft stored: level marks, guide text, model-reported confidence');
  ok(Object.keys(jevBodies[0].questions).join(',') === 'q,k1,k2,k3,k4,k5,k6,k7,k8,k9' && jevBodies.length === 1, 'key-point yes/no questions ride in the same single request');
  const cl = d.checklist; ok(cl.length === 9 && cl[0].status === 'covered' && cl[1].status === 'uncertain' && cl[2].status === 'not covered' && cl[3].status === 'unknown' && cl[3].p === null, 'checklist: covered / uncertain / not covered / unknown (missing answer kept as unknown)');
  ok(!('reason' in d), 'no fabricated reason field, only the matching guide text');
  ok(Object.keys(x.g.marks).length === 0 && x.g.released === false, 'draft is not marks and is not released');
  ok(!JSON.stringify(x.me).includes('FULL-GUIDE') && !JSON.stringify(x.me).includes('"draft"') && !JSON.stringify(x.me).includes('confidence'), 'student never sees the draft');
  // 3 teacher final gate: marks only via teacher PATCH
  let r: any = await t('demo-user', 'PATCH', `/roster/${P}/${x.row}/marks`, { questionId: 'q1', marks: 4, reason: 'teacher adjusted' });
  ok(r.status === 200, 'teacher saves final marks by hand');
  // 4 failure path
  jevMode = 'fail'; x = await run('demo-user', P, 'A3', JEV_FIXTURES.partial);
  ok(x.g.draft.q1.state === 'failed' && /by hand/.test(x.g.draft.q1.note), 'Jev failure shows explicit failed state, submission kept'); jevMode = 'ok';
  // 5 per-paper cap (3 calls used so far: A2, A3) -> A4 ok (3rd), A5 ok (4th), A6 blocked
  await run('demo-user', P, 'A4', JEV_FIXTURES.weak); const before = jevBodies.length;
  await run('demo-user', P, 'A5', JEV_FIXTURES.weak); x = await run('demo-user', P, 'A6', JEV_FIXTURES.weak);
  ok(x.g.draft.q1.state === 'failed' && jevBodies.length === before + 1, 'per-paper cap of 4 holds, 5th makes no call');
  // 6 other papers and other owners never send
  const before2 = jevBodies.length;
  const P2 = await mk('demo-user'); x = await run('demo-user', P2, 'B1', JEV_FIXTURES.full); ok(Object.keys(x.g.draft).length === 0, 'other paper of the demo account: no draft (one-paper lock preserved)');
  const P3 = await mk('someone-else'); x = await run('someone-else', P3, 'C1', JEV_FIXTURES.full); ok(Object.keys(x.g.draft).length === 0, 'other account: no draft');
  const P4 = await mk('demo-user', 'Name the capital of France'); process.env.JEV_DEMO_ASSIGNMENT_ID = P4; x = await run('demo-user', P4, 'D1', JEV_FIXTURES.full); ok(Object.keys(x.g.draft).length === 0, 'fixture on a mismatched question: not sent');
  ok(jevBodies.length === before2, 'no Jev call for any non-eligible case');
  process.env.JEV_ENABLED = 'false'; process.env.JEV_DEMO_ASSIGNMENT_ID = P; x = await run('demo-user', P, 'E1', JEV_FIXTURES.full); ok(jevBodies.length === before2 && Object.keys(x.g.draft).length === 0, 'switch off: nothing sent');
  srv.close(); console.log(`auto draft (mocked Jev): ${n} assertions passed`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
