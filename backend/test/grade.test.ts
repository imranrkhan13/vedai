// Grading-demo route test: in-memory Postgres, stubbed Redis, MOCKED Jev fetch. No provider calls.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';

process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-test-secret-test-secret';
const src = (f: string) => path.resolve(__dirname, '../src', f);
const stub = (f: string, exports: any) => { require.cache[require.resolve(src(f))] = { id: src(f), filename: src(f), loaded: true, exports } as any; };
const counters = new Map<string, number>();
stub('services/redis.ts', { getRedis: () => ({
  get: async () => null, setex: async () => 'OK', del: async () => 1,
  incr: async (k: string) => { const n = (counters.get(k) || 0) + 1; counters.set(k, n); return n; },
  decr: async (k: string) => { const n = (counters.get(k) || 1) - 1; counters.set(k, n); return n; },
  expire: async () => 1 }) });
stub('services/queue.ts', { getAssignmentQueue: () => ({ add: async () => ({ id: '1' }) }) });

let jevMode: 'ok' | 'http500' | 'badshape' = 'ok'; let jevCalls = 0; let lastBody: any = null;
const realFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string, init: any) => {
  if (String(url).startsWith('http://127.0.0.1')) return realFetch(url, init);
  if (!String(url).includes('api.typesafe.ai')) throw new Error('unexpected fetch ' + url);
  jevCalls++; lastBody = JSON.parse(init.body);
  if (jevMode === 'http500') return { ok: false, status: 500, json: async () => ({}) } as any;
  if (jevMode === 'badshape') return { ok: true, status: 200, json: async () => ({ answers: {} }) } as any;
  return { ok: true, status: 200, json: async () => ({ model: 'jev-1.13.0', answers: { q: { type: 'score', score: 1.6, confidence: 0.5, probabilities: { '0': 0.1, '1': 0.3, '2': 0.6 } } } }) } as any;
};

(async () => {
  const { setDb, SCHEMA_SQL } = await import('../src/services/db');
  const pg = new PGlite(); await pg.exec(SCHEMA_SQL);
  setDb({ query: async (t, p) => { const r = await pg.query(t, p as any[]); return { rows: r.rows as any[], rowCount: r.affectedRows ?? r.rows.length }; } });
  const { Assignment } = await import('../src/models/Assignment');
  const router = (await import('../src/routes/assignments')).default;
  const { signToken } = await import('../src/services/auth');
  const app = express(); app.use(express.json()); app.use('/api/assignments', router);
  const srv = app.listen(0); const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/assignments`;
  let n = 0; const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };
  const DEMO = 'demo-user', OTHER = 'other-user';
  const call = async (tok: string, id: string, method: string, body: any) => { const r = await fetch(`${base}/${id}/grade`, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signToken(tok) }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() as any }; };
  const mk = async (owner: string) => {
    const a = await Assignment.create({ title: 'T', subject: 'S', dueDate: '2026-12-31', questionTypes: ['Long'], numberOfQuestions: 1, totalMarks: 5, difficulty: 'mixed' } as any, owner);
    await Assignment.setCompleted(a._id, { subject: 'S', totalMarks: 5, generatedAt: new Date(), sections: [{ title: 'A', instruction: '', totalMarks: 5, questions: [
      { id: 'q1', text: 'Explain photosynthesis', difficulty: 'easy', marks: 5, type: 'Long', rubric: [{ marks: 5, descriptor: 'All parts', example: 'e' }, { marks: 3, descriptor: 'Most parts', example: 'e' }, { marks: 0, descriptor: 'Wrong', example: 'e' }] },
      { id: 'q2', text: 'MCQ', difficulty: 'easy', marks: 1, type: 'MCQ' }] }] } as any);
    return a._id;
  };
  const demoId = await mk(DEMO), otherPaper = await mk(DEMO);
  const send = (id: string, extra: any = {}) => call(DEMO, id, 'POST', { questionId: 'q1', fixture: 'full', ...extra });

  let r = await send(demoId); ok(r.status === 503, 'closed with no env');
  process.env.JEV_ENABLED = 'true'; process.env.JEV_API_KEY = 'test-key'; process.env.JEV_DEMO_USER_ID = DEMO; process.env.JEV_DEMO_ASSIGNMENT_ID = demoId;
  process.env.JEV_MAX_PER_PAPER = '4'; process.env.JEV_MAX_PER_DAY = '15';
  r = await call(DEMO, demoId, 'POST', { questionId: 'q1', answer: 'SYNTHETIC TEST free text typed by a user' }); ok(r.status === 400 && jevCalls === 0, 'free text rejected, no call');
  r = await call(OTHER, demoId, 'POST', { questionId: 'q1', fixture: 'full' }); ok(r.status === 403 && jevCalls === 0, 'non-demo account 403, no call');
  r = await send(otherPaper); ok(r.status === 403 && jevCalls === 0, 'other paper of demo account 403, no call');
  r = await call(DEMO, demoId, 'POST', { questionId: 'q2', fixture: 'full' }); ok(r.status === 400 && jevCalls === 0, 'MCQ without rubric 400, no call');
  r = await send(demoId); ok(r.status === 200 && jevCalls === 1, 'happy path calls Jev once');
  ok(lastBody.model === 'jev-1.13.0' && lastBody.questions.q.criteria.join('|') === 'Wrong|Most parts|All parts', 'rubric sent ascending, descriptors only');
  ok(lastBody.state.student_answer.startsWith('SYNTHETIC TEST') && !JSON.stringify(lastBody).includes('typed by a user'), 'server fixture sent, never user text');
  const g = r.body.data.grade; ok(g.levelIndex === 2 && g.marks === 5 && g.confidence === 0.5, 'argmax level 2 -> 5 marks (not blended 1.6 -> 2)');
  // teacher edit validation
  r = await call(DEMO, demoId, 'PATCH', { questionId: 'q1', marks: 9 }); ok(r.status === 400, 'marks above max 400');
  r = await call(OTHER, demoId, 'PATCH', { questionId: 'q1', marks: 2 }); ok(r.status === 404, 'other owner PATCH 404');
  r = await call(DEMO, demoId, 'PATCH', { questionId: 'q1', marks: 4, reason: 'edit' }); ok(r.status === 200, 'teacher edit saved');
  const before = jevCalls;
  r = await send(demoId); ok(r.status === 409 && jevCalls === before, 'regrade after edit needs confirm, no call');
  r = await send(demoId, { overwrite: true }); ok(r.status === 200 && jevCalls === before + 1, 'overwrite regrades');
  const out = (await Assignment.findById(demoId, DEMO))!.output as any; const q1 = out.sections[0].questions[0];
  ok(q1.gradeHistory.length === 1 && q1.gradeHistory[0].teacherMarks === 4 && q1.grade.teacherMarks === undefined, 'teacher mark preserved in history on overwrite');
  ok(out.gradeCalls === 2, 'per-paper counter 2');
  // failure paths count against allowance, never change the grade
  jevMode = 'http500'; r = await send(demoId, { overwrite: true }); ok(r.status === 502, 'Jev 500 -> 502');
  jevMode = 'badshape'; r = await send(demoId, { overwrite: true }); ok(r.status === 502, 'bad shape -> 502');
  const out2 = (await Assignment.findById(demoId, DEMO))!.output as any;
  ok(out2.gradeCalls === 4 && out2.sections[0].questions[0].grade.marks === 5, 'failures cost allowance, grade unchanged');
  jevMode = 'ok'; const c4 = jevCalls; r = await send(demoId, { overwrite: true }); ok(r.status === 429 && jevCalls === c4, 'paper cap 429, no call');
  // daily cap
  process.env.JEV_MAX_PER_DAY = '15';
  srv.close(); console.log(`grade tests passed: ${n} assertions`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
