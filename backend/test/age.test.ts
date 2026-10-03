// Age-group gates + feedback wording. No network. Proves the gates and wording, not grading quality.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-test-secret-test-secret';
const src = (f: string) => path.resolve(__dirname, '../src', f);
const stub = (f: string, exports: any) => { require.cache[require.resolve(src(f))] = { id: src(f), filename: src(f), loaded: true, exports } as any; };
stub('services/redis.ts', { getRedis: () => ({ get: async () => null, setex: async () => 'OK', del: async () => 1, incr: async () => 1, decr: async () => 0, expire: async () => 1 }) });
stub('services/queue.ts', { getAssignmentQueue: () => ({ add: async () => ({ id: '1' }) }) });
let outbound = 0; const realFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string, init: any) => { if (String(url).startsWith('http://127.0.0.1')) return realFetch(url, init); outbound++; throw new Error('unexpected outbound ' + url); };
(async () => {
  const { setDb, SCHEMA_SQL } = await import('../src/services/db');
  const pg = new PGlite(); await pg.exec(SCHEMA_SQL);
  setDb({ query: async (t, p) => { const r = await pg.query(t, p as any[]); return { rows: r.rows as any[], rowCount: r.affectedRows ?? r.rows.length }; } });
  const { Assignment } = await import('../src/models/Assignment');
  const { teacherRoster, studentPortal } = await import('../src/routes/roster');
  const { realAnswerAiGate, feedbackFor } = await import('../src/services/feedback');
  const { signToken } = await import('../src/services/auth');
  const app = express(); app.use(express.json()); app.use('/api/roster', teacherRoster); app.use('/api/student', studentPortal);
  const srv = app.listen(0); const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api`;
  let n = 0; const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };
  const t = async (method: string, p: string, body?: any) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signToken('teach') }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.json() as any }; };
  const a = await Assignment.create({ title: 'SYNTHETIC TEST age', subject: 'S', dueDate: '2099-12-31', questionTypes: ['Long'], numberOfQuestions: 1, totalMarks: 10, difficulty: 'mixed' } as any, 'teach');
  await Assignment.setCompleted(a._id, { subject: 'S', totalMarks: 10, generatedAt: new Date(), sections: [{ title: 'A', instruction: '', totalMarks: 10, questions: [{ id: 'q1', text: 'Q', difficulty: 'easy', marks: 10, type: 'Long', answer: 'SECRET-KEY', rubric: [] }] }] } as any);
  const P = a._id;
  // pure gate
  ok(!realAnswerAiGate({ age_group: 'under18', ai_consent: true }).allowed, 'under 18 never allowed, even with consent flag');
  ok(!realAnswerAiGate({ age_group: 'unknown', ai_consent: true }).allowed, 'unknown never allowed');
  ok(!realAnswerAiGate({ age_group: 'adult', ai_consent: false }).allowed, 'adult without consent not allowed');
  ok(!realAnswerAiGate({ age_group: 'adult', ai_consent: true }).allowed, 'adult with consent still blocked while switch is off');
  process.env.REAL_ANSWER_AI = 'on'; ok(realAnswerAiGate({ age_group: 'adult', ai_consent: true }).allowed && !realAnswerAiGate({ age_group: 'under18', ai_consent: true }).allowed, 'switch on: only consenting adult passes'); delete process.env.REAL_ANSWER_AI;
  // wording: same marks, different words
  const m = { marks: 7, reason: 'Good start' };
  const fa = feedbackFor('adult', 10, m)!, fy = feedbackFor('under18', 10, m)!, fu = feedbackFor('unknown', 10, m)!;
  ok(fa.style === 'full' && fa.text.includes('7 out of 10') && fa.text.includes('70%') && fa.text.includes('Good start'), 'adult feedback is fuller');
  ok(fy.style === 'simple' && fy.text.includes('7 out of 10') && !fy.text.includes('%') && fu.style === 'simple', 'under 18 and unknown get simple wording, same number');
  ok(feedbackFor('adult', 10, undefined) === null && feedbackFor('adult', 0, m) === null, 'no marks, no feedback');
  // API
  const add = async (sid: string, ageGroup?: string) => { const r = await t('POST', `/roster/${P}`, ageGroup ? { studentId: sid, ageGroup } : { studentId: sid }); return { code: r.body.data.accessCode as string, row: r.body.data.id as string, status: r.status }; };
  const login = async (sid: string, code: string) => { const l = await fetch(base + '/student/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quillix' }, body: JSON.stringify({ studentId: sid, accessCode: code }) }); return (l.headers.get('set-cookie') || '').split(';')[0]; };
  const sp = (ck: string, method: string, p: string, body?: any) => fetch(base + '/student' + p, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quillix', Cookie: ck }, body: body === undefined ? undefined : JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() as any }));
  const kids: Record<string, any> = {};
  for (const [sid, g] of [['U1', 'under18'], ['A1', 'adult'], ['N1', undefined]] as const) { const s = await add(sid, g); ok(s.status === 201, 'added ' + sid); const ck = await login(sid, s.code); kids[sid] = { ...s, ck }; await sp(ck, 'POST', '/submit', { answers: { q1: 'some typed answer' } }); await t('PATCH', `/roster/${P}/${s.row}/marks`, { questionId: 'q1', marks: 7, reason: 'Good start' }); await t('POST', `/roster/${P}/${s.row}/release`, { released: true }); }
  const list = (await t('GET', `/roster/${P}`)).body.data.students; ok(list.find((x: any) => x.studentId === 'N1').ageGroup === 'unknown' && list.find((x: any) => x.studentId === 'U1').ageGroup === 'under18', 'age group stored; default unknown');
  ok((await t('POST', `/roster/${P}`, { studentId: 'BAD', ageGroup: 'dob-2001' })).status === 400, 'only the three groups are accepted, no date of birth');
  const me = async (sid: string) => (await sp(kids[sid].ck, 'GET', '/me')).body.data;
  const mu = await me('U1'), ma = await me('A1'), mn = await me('N1');
  ok(mu.submission.total === 7 && ma.submission.total === 7 && mn.submission.total === 7, 'marks identical across age groups');
  ok(mu.submission.feedback.q1.style === 'simple' && ma.submission.feedback.q1.style === 'full' && mn.submission.feedback.q1.style === 'simple', 'wording differs by group');
  ok(!JSON.stringify(ma).includes('SECRET-KEY'), 'feedback does not reveal the answer key');
  // unreleased -> no feedback
  await t('POST', `/roster/${P}/${kids.A1.row}/release`, { released: false });
  ok((await me('A1')).submission.feedback === null && (await me('A1')).submission.marks === null, 'hidden marks give no feedback');
  // consent
  ok((await sp(kids.U1.ck, 'POST', '/consent', { agree: true })).status === 403 && (await sp(kids.N1.ck, 'POST', '/consent', { agree: true })).status === 403, 'under 18 and unset cannot record consent');
  ok((await sp(kids.A1.ck, 'POST', '/consent', { agree: true })).status === 200 && (await me('A1')).student.aiConsent === true, 'adult can record consent');
  ok((await t('PATCH', `/roster/${P}/${kids.A1.row}/age-group`, { ageGroup: 'under18' })).status === 200 && (await me('A1')).student.aiConsent === false, 'changing group clears consent');
  ok((await t('PATCH', `/roster/${P}/${kids.A1.row}/age-group`, { ageGroup: 'x' })).status === 400, 'bad group rejected');
  ok(outbound === 0, 'no outbound network calls at all');
  console.log(`age tests passed: ${n}`); srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
