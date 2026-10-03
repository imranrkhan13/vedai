// Student portal test: in-memory Postgres, stubbed Redis. Global fetch is a tripwire: any outbound call (e.g. to an AI provider) fails the test.
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

let outbound = 0;
const realFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string, init: any) => { if (String(url).startsWith('http://127.0.0.1')) return realFetch(url, init); outbound++; throw new Error('unexpected outbound fetch ' + url); };

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
  const T1 = 'teacher-1', T2 = 'teacher-2';
  const t = async (tok: string, method: string, p: string, body?: any) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signToken(tok) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.json() as any }; };
  let cookie = '';
  const s = async (method: string, p: string, body?: any, withCsrf = true, ck = cookie) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}), ...(withCsrf ? { 'X-Requested-With': 'quillix' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get('set-cookie'); if (sc && p === '/student/login' || (sc && p.endsWith('/login'))) cookie = (sc || '').split(';')[0];
    return { status: r.status, body: await r.json() as any, setCookie: sc };
  };
  const mk = async (owner: string, due = '2099-12-31') => {
    const a = await Assignment.create({ title: 'T', subject: 'S', dueDate: due, questionTypes: ['Long'], numberOfQuestions: 2, totalMarks: 6, difficulty: 'mixed' } as any, owner);
    await Assignment.setCompleted(a._id, { subject: 'S', totalMarks: 6, generatedAt: new Date(), sections: [{ title: 'A', instruction: '', totalMarks: 6, questions: [
      { id: 'q1', text: 'Explain photosynthesis', difficulty: 'easy', marks: 5, type: 'Long', answer: 'SECRET-KEY', evidence: 'SECRET-EVIDENCE', rubric: [{ marks: 5, descriptor: 'SECRET-RUBRIC', example: 'e' }, { marks: 3, descriptor: 'm', example: 'e' }, { marks: 0, descriptor: 'w', example: 'e' }] },
      { id: 'q2', text: 'Pick one', difficulty: 'easy', marks: 1, type: 'MCQ', options: ['a1', 'a2'], answer: 'a1' }] }] } as any);
    return a._id;
  };
  const A = await mk(T1), B = await mk(T2), late = await mk(T1, '2000-01-01');

  // teacher: add students
  let r: any = await t(T1, 'POST', `/roster/${A}`, { studentId: 'S 001' }); ok(r.status === 400, 'ID with a space rejected');
  r = await t(T1, 'POST', `/roster/${A}`, { studentId: 'S001', name: 'Asha' }); ok(r.status === 201 && /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(r.body.data.accessCode), 'student added with random access code');
  const code1 = r.body.data.accessCode as string, row1 = r.body.data.id as string;
  r = await t(T1, 'POST', `/roster/${A}`, { studentId: 's001' }); ok(r.status === 409, 'duplicate ID (case-insensitive) rejected');
  r = await t(T1, 'POST', `/roster/${A}`, { studentId: 'S002' }); const code2 = r.body.data.accessCode as string, row2 = r.body.data.id as string; ok(r.status === 201 && code2 !== code1, 'second student, different code');
  r = await t(T2, 'POST', `/roster/${B}`, { studentId: 'S001' }); ok(r.status === 201, 'same ID allowed on another teacher paper'); const codeB = r.body.data.accessCode as string;
  r = await t(T2, 'POST', `/roster/${A}`, { studentId: 'X' }); ok(r.status === 404, 'other teacher cannot add to my paper');
  r = await t(T2, 'GET', `/roster/${A}`); ok(r.status === 404, 'other teacher cannot list my roster');
  r = await t(T1, 'GET', `/roster/${A}`); ok(r.body.data.students.length === 2 && !JSON.stringify(r.body).includes(code1.replace('-', '')) , 'list never shows access codes');
  const stored = (await pg.query('SELECT access_hash FROM vedai_students')).rows.map((x: any) => x.access_hash).join(',');
  ok(!stored.includes(code1.replace('-', '')), 'only a hash is stored');

  // student login
  r = await s('POST', '/student/login', { studentId: 'S001', accessCode: 'WRONG-CODE1' }); ok(r.status === 401, 'wrong code rejected');
  r = await s('POST', '/student/login', { studentId: 'S001', accessCode: code2 }); ok(r.status === 401, 'ID alone / another student code rejected');
  r = await s('POST', '/student/login', { studentId: 'S002', accessCode: codeB }); ok(r.status === 401, 'another paper\'s code does not work with my student ID');
  r = await s('GET', '/student/me', undefined, true, ''); ok(r.status === 401, 'no cookie, no access');
  r = await s('POST', '/student/login', { studentId: 's001', accessCode: code1.toLowerCase().replace('-', ' ') }); ok(r.status === 200 && /HttpOnly/.test(r.setCookie || ''), 'login ok (case/format tolerant), httpOnly cookie');
  ok(cookie.startsWith('qx_student='), 'student cookie set');
  const studentCookie = cookie;
  // teacher bearer cannot be used as student and student cookie cannot be used as teacher
  r = await s('GET', '/student/me', undefined, true, `qx_student=${signToken('x')}`); ok(r.status === 401, 'teacher-style token rejected on student route');
  r = await fetch(base + `/roster/${A}`, { headers: { Cookie: studentCookie, Authorization: 'Bearer ' + (studentCookie.split('=')[1]) } }).then(async (x) => ({ status: x.status, body: null as any })); ok(r.status === 401, 'student token rejected on teacher route');

  r = await s('GET', '/student/me'); const raw = JSON.stringify(r.body);
  ok(r.status === 200 && r.body.data.assignment.questions.length === 2 && r.body.data.assignment.questions[1].options.length === 2, 'student sees questions and options');
  ok(!/SECRET-KEY|SECRET-EVIDENCE|SECRET-RUBRIC|rubric|answerKey|evidence/.test(raw), 'no answer key, evidence or marking levels leak to the student');
  ok(r.body.data.submission.submitted === false, 'not submitted yet');

  // submit
  r = await s('POST', '/student/submit', { answers: { q1: 'x' } }, false); ok(r.status === 403, 'CSRF header required');
  r = await s('POST', '/student/submit', { answers: { nope: 'x' } }); ok(r.status === 400, 'unknown question rejected');
  r = await s('POST', '/student/submit', { answers: { q1: '   ' } }); ok(r.status === 400, 'empty submission rejected');
  r = await s('POST', '/student/submit', { answers: { q1: 'y'.repeat(5001) } }); ok(r.status === 400, 'over-long answer rejected');
  r = await s('POST', '/student/submit', { answers: { q1: 'My answer about light', q2: 'a2' } }); ok(r.status === 201 && r.body.data.late === false, 'submit ok, on time');
  r = await s('POST', '/student/submit', { answers: { q1: 'changed' } }); ok(r.status === 409, 'second submit blocked');
  r = await s('GET', '/student/me'); ok(r.body.data.submission.answers.q1 === 'My answer about light' && r.body.data.submission.marks === null, 'answers kept, marks hidden before release');

  // teacher review
  r = await t(T1, 'GET', `/roster/${A}`); const st = r.body.data.students.find((x: any) => x.studentId === 'S001'); ok(st.submitted && st.markedTotal === 0, 'queue shows submitted');
  r = await t(T2, 'GET', `/roster/${A}/${row1}`); ok(r.status === 404, 'other teacher cannot read submission');
  r = await t(T1, 'GET', `/roster/${A}/${row1}`); ok(r.status === 200 && r.body.data.answers.q1 === 'My answer about light' && r.body.data.questions[0].rubric.length === 3, 'teacher sees answer plus marking guide');
  r = await t(T1, 'PATCH', `/roster/${A}/${row2}/marks`, { questionId: 'q1', marks: 3 }); ok(r.status === 409, 'cannot mark a student who has not submitted');
  r = await t(T1, 'PATCH', `/roster/${A}/${row1}/marks`, { questionId: 'q1', marks: 6 }); ok(r.status === 400, 'marks above max rejected');
  r = await t(T1, 'PATCH', `/roster/${A}/${row1}/marks`, { questionId: 'q1', marks: 2.5 }); ok(r.status === 400, 'non-integer marks rejected');
  r = await t(T1, 'PATCH', `/roster/${A}/${row1}/marks`, { questionId: 'q1', marks: 3, reason: 'Missed chlorophyll' }); ok(r.status === 200 && r.body.data.total === 3, 'teacher marks saved');
  r = await t(T1, 'PATCH', `/roster/${A}/${row1}/marks`, { questionId: 'q2', marks: 1 }); ok(r.body.data.total === 4, 'second question total');
  r = await s('GET', '/student/me'); ok(r.body.data.submission.marks === null, 'still hidden until released');
  r = await t(T1, 'POST', `/roster/${A}/${row1}/release`, { released: true }); ok(r.status === 200, 'released');
  r = await s('GET', '/student/me'); ok(r.body.data.submission.total === 4 && r.body.data.submission.marks.q1.reason === 'Missed chlorophyll', 'student sees marks after release');

  // lateness
  r = await t(T1, 'POST', `/roster/${late}`, { studentId: 'L1' }); const lc = r.body.data.accessCode as string;
  cookie = ''; r = await s('POST', '/student/login', { studentId: 'L1', accessCode: lc }); r = await s('POST', '/student/submit', { answers: { q1: 'late one' } }); ok(r.status === 201 && r.body.data.late === true, 'late submission flagged, not blocked');

  // reset code ends old session and old code
  r = await t(T1, 'POST', `/roster/${A}/${row1}/reset`); const code1b = r.body.data.accessCode as string; ok(r.status === 200 && code1b !== code1, 'code reset');
  r = await s('GET', '/student/me', undefined, true, studentCookie); ok(r.status === 401, 'old session ended after reset');
  cookie = ''; r = await s('POST', '/student/login', { studentId: 'S001', accessCode: code1 }); ok(r.status === 401, 'old code rejected');
  r = await s('POST', '/student/login', { studentId: 'S001', accessCode: code1b }); ok(r.status === 200, 'new code works');

  // brute-force limiter per ID
  let last = 0; for (let i = 0; i < 12; i++) { last = (await s('POST', '/student/login', { studentId: 'S002', accessCode: 'AAAAAAAAAA' })).status; }
  ok(last === 429, 'login attempts per ID are rate limited');

  // delete student removes access
  r = await t(T1, 'DELETE', `/roster/${A}/${row2}`); ok(r.status === 200, 'student removed');

  // paper delete cascades to students and submissions and ends sessions; another owner's delete does nothing
  r = await t(T1, 'POST', `/roster/${A}`, { studentId: 'D1' }); const dc = r.body.data.accessCode as string;
  cookie = ''; await s('POST', '/student/login', { studentId: 'D1', accessCode: dc }); const dCookie = cookie;
  await s('POST', '/student/submit', { answers: { q1: 'to be deleted' } }, true, dCookie);
  ok(await Assignment.deleteById(A, T2) === false, 'other owner cannot delete my paper');
  ok((await pg.query('SELECT 1 FROM vedai_students WHERE assignment_id=$1', [A])).rows.length >= 1, 'roster untouched by a failed delete');
  ok(await Assignment.deleteById(A, T1) === true, 'owner deletes paper');
  ok((await pg.query('SELECT 1 FROM vedai_students WHERE assignment_id=$1', [A])).rows.length === 0, 'students deleted with the paper');
  ok((await pg.query('SELECT 1 FROM vedai_submissions WHERE assignment_id=$1', [A])).rows.length === 0, 'submissions deleted with the paper');
  ok((await s('GET', '/student/me', undefined, true, dCookie)).status === 401, 'student session ends after the paper is deleted');
  ok((await pg.query('SELECT 1 FROM vedai_students WHERE assignment_id=$1', [B])).rows.length === 1, 'other teacher roster untouched');
  ok(outbound === 0, 'no outbound network call at any point (no AI provider calls)');
  srv.close(); console.log(`student portal: ${n} assertions passed`); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
