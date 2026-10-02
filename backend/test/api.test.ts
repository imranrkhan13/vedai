// HTTP + worker integration test on in-memory Postgres. Queue/Redis/WebSocket are stubbed; no AI keys set, so no provider calls.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';

for (const k of ['GEMINI_API_KEY','OPENROUTER_API_KEY','MISTRAL_API_KEY','COHERE_API_KEY','GROK_API_KEY']) delete process.env[k];

const src = (f: string) => path.resolve(__dirname, '../src', f);
const stub = (f: string, exports: any) => { require.cache[require.resolve(src(f))] = { id: src(f), filename: src(f), loaded: true, exports } as any; };
const cache = new Map<string, string>();
const jobs: any[] = [];
stub('services/redis.ts', { getRedis: () => ({ get: async (k: string) => cache.get(k) ?? null, setex: async (k: string, _t: number, v: string) => { cache.set(k, v); }, del: async (k: string) => { cache.delete(k); }, publish: async () => 0 }) });
stub('services/queue.ts', { getAssignmentQueue: () => ({ add: async (_n: string, data: any) => { const j = { id: String(jobs.length + 1), data }; jobs.push(j); return j; }, getJob: async () => null }) });
const notices: any[] = [];
stub('services/websocket.ts', { notifyClient: (id: string, p: any) => notices.push([id, p]), initWebSocket: () => {} });

(async () => {
  const { setDb, SCHEMA_SQL } = await import('../src/services/db');
  const pg = new PGlite(); await pg.exec(SCHEMA_SQL);
  setDb({ query: async (t, p) => { const r = await pg.query(t, p as any[]); return { rows: r.rows as any[], rowCount: r.affectedRows ?? r.rows.length }; } });
  const router = (await import('../src/routes/assignments')).default;
  const { processAssignmentJob, shouldRunWorkerInWeb } = await import('../src/worker');

  const app = express(); app.use(express.json()); app.use('/api/assignments', router);
  const srv = app.listen(0); const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/assignments`;
  const { signToken, verifyToken, hashPassword, verifyPassword } = await import('../src/services/auth');
  const T1 = signToken('user-1'), T2 = signToken('user-2');
  let tok = T1;
  const j = async (u: string, o?: RequestInit) => { const r = await fetch(base + u, { headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, ...o }); return { status: r.status, body: await r.json() as any }; };
  let n = 0; const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };

  const body = { title: 'Unit test', subject: 'Science', dueDate: '2026-10-15', questionTypes: ['MCQ', 'Short'], numberOfQuestions: 6, totalMarks: 30, difficulty: 'mixed', clientId: 'c1' };
  let r = await j('', { method: 'POST', body: JSON.stringify(body) });
  ok(r.status === 201 && r.body.success, 'create 201');
  const id = r.body.data.id; ok(id === r.body.data._id && /^[0-9a-f-]{36}$/.test(id), 'id and _id returned');
  ok(jobs.length === 1 && jobs[0].data.assignmentId === id && jobs[0].data.clientId === 'c1', 'job enqueued with assignmentId+clientId');
  r = await j('', { method: 'POST', body: JSON.stringify({ ...body, dueDate: 'nope' }) }); ok(r.status === 400, 'bad date 400');
  r = await j('', { method: 'POST', body: JSON.stringify({ title: '' }) }); ok(r.status === 400, 'validation 400');

  r = await j('/' + id); ok(r.body.data._id === id && r.body.data.status === 'pending' && r.body.data.jobId === '1', 'get pending, jobId stored');
  ok(r.body.data.dueDate.startsWith('2026-10-15') && Array.isArray(r.body.data.questionTypes), 'frontend fields: dueDate ISO, questionTypes array');

  // honest failure when no provider works (default)
  await processAssignmentJob({ id: '0', data: jobs[0].data, updateProgress: async () => {} } as any).then(() => assert.fail('should throw'), (e) => { ok(/AI providers/.test(e.message), 'no-provider run throws'); });
  process.env.ALLOW_MOCK_OUTPUT = 'true';
  await processAssignmentJob({ id: '1', data: jobs[0].data, updateProgress: async () => {} } as any); // worker persistence, mock paper (no keys)
  ok(notices.some(([c, p]) => c === 'c1' && p.type === 'job:completed'), 'worker notified completion');
  r = await j('/' + id);
  const o = r.body.data.output;
  ok(r.body.data.status === 'completed' && o && Array.isArray(o.sections) && o.sections.length > 0, 'output persisted with sections');
  ok(typeof o.sections[0].title === 'string' && Array.isArray(o.sections[0].questions) && o.sections[0].questions[0].difficulty && typeof o.sections[0].questions[0].marks === 'number', 'output matches frontend Section/Question types');
  ok(typeof o.generatedAt === 'string' && o.totalMarks > 0, 'generatedAt string, totalMarks');
  ok(cache.has('assignment:' + id), 'completed result cached');
  ok(o.schoolName === 'SAMPLE PAPER (not AI-generated)', 'mock output is labelled');
  delete process.env.ALLOW_MOCK_OUTPUT;

  r = await j(''); ok(r.body.data.length === 1 && r.body.data[0]._id === id && r.body.data[0].output === undefined, 'list shape, no output');

  // auth and per-owner isolation
  tok = '';
  r = await j(''); ok(r.status === 401, 'list without token is 401');
  r = await j('/' + id); ok(r.status === 401, 'get without token is 401');
  r = await j('/' + id, { method: 'DELETE' }); ok(r.status === 401, 'delete without token is 401');
  r = await j(`/${id}/regenerate`, { method: 'POST', body: '{}' }); ok(r.status === 401, 'regenerate without token is 401');
  tok = T1.slice(0, -2) + 'xx'; r = await j(''); ok(r.status === 401, 'tampered token is 401');
  tok = signToken('user-1', -10); r = await j(''); ok(r.status === 401, 'expired token is 401');
  tok = T2;
  r = await j(''); ok(r.status === 200 && r.body.data.length === 0, 'other user sees an empty list');
  r = await j('/' + id); ok(r.status === 404, 'other user cannot read it, even though it is cached');
  r = await j(`/${id}/regenerate`, { method: 'POST', body: '{}' }); ok(r.status === 404, 'other user cannot regenerate');
  r = await j('/' + id, { method: 'DELETE' }); ok(r.status === 404, 'other user cannot delete');
  ok(verifyToken(T1) === 'user-1' && verifyToken('a.b') === null, 'token verify');
  ok(verifyPassword('correct horse', hashPassword('correct horse')) && !verifyPassword('wrong', hashPassword('correct horse')), 'password hashing');
  tok = T1;
  r = await j(`/${id}/regenerate`, { method: 'POST', body: JSON.stringify({ clientId: 'c1' }) });
  ok(r.status === 200 && jobs.length === 2 && !cache.has('assignment:' + id), 'regenerate queues job, clears cache');
  r = await j('/' + id); ok(r.body.data.status === 'pending' && r.body.data.output === undefined && r.body.data.jobId === '2', 'regenerate reset state');

  await processAssignmentJob({ id: '9', data: { assignmentId: '00000000-0000-0000-0000-000000000000' }, updateProgress: async () => {} } as any).then(() => assert.fail('should throw'), () => { n++; });
  r = await j('/not-a-uuid'); ok(r.status === 404, 'bad id 404');
  r = await j('/' + id, { method: 'DELETE' }); ok(r.body.success, 'delete ok');
  r = await j('/' + id); ok(r.status === 404, 'deleted -> 404');
  ok(!shouldRunWorkerInWeb({} as any) && !shouldRunWorkerInWeb({ WORKER_IN_WEB: 'false' } as any) && !shouldRunWorkerInWeb({ WORKER_IN_WEB: '1' } as any), 'worker-in-web off by default');
  const { allowedProviders, resolveOpenRouterModel, resolveOpenRouterModels, redactError, parseResponse } = await import('../src/services/aiGenerator');
  ok(resolveOpenRouterModel({ OPENROUTER_MODEL: 'google/gemma-4-31b-it:free' } as any) === 'google/gemma-4-31b-it:free' && resolveOpenRouterModel({} as any).endsWith(':free'), 'openrouter free model accepted/default is free');
  ok(resolveOpenRouterModels({ OPENROUTER_MODEL: 'a/b:free, c/d:free' } as any).length === 2 && resolveOpenRouterModels({ OPENROUTER_MODEL: 'a:free,b:free,c:free,d:free' } as any).length === 3, 'free model list capped at 3');
  { const A: any = { subject: 'S', numberOfQuestions: 2, totalMarks: 4, questionTypes: ['Multiple Choice Questions', 'Short Questions'] };
    const good = JSON.stringify({ sections: [{ title: 'A', questions: [{ text: 'Q1?', marks: 2, type: 'MCQ', difficulty: 'easy', options: ['a', 'b', 'c', 'd'], answer: 'b' }, { text: 'Q2?', marks: 2, type: 'Short', difficulty: 'easy', answer: 'x' }] }] });
    const g = parseResponse(good, A);
    ok(g.sections[0].questions[0].options?.length === 4 && g.sections[0].questions[0].answer === 'b' && g.totalMarks === 4, 'parse keeps MCQ options, answer, real marks total');
    ok(parseResponse(good.replace('}]}]}', '}]},{"title":"C","questions":[]}]}'), A).sections.length === 1, 'empty sections are dropped');
    assert.throws(() => parseResponse(good.replace('"options":["a","b","c","d"],', ''), A), /MCQ without answer choices/); n++;
    { const P: any = { ...A, numberOfQuestions: 3, totalMarks: 5, questionPlan: [{ type: 'Multiple Choice Questions', qty: 1, marks: 1 }, { type: 'Short Questions', qty: 2, marks: 2 }] };
      const three = JSON.stringify({ sections: [{ title: 'A', questions: [{ text: 'Q1?', marks: 1, type: 'MCQ', options: ['a', 'b', 'c', 'd'], answer: 'a' }, { text: 'Q2?', marks: 2, type: 'Short', answer: 'x' }, { text: 'Q3?', marks: 2, type: 'Short', answer: 'y' }] }] });
      ok(parseResponse(three, P).totalMarks === 5, 'plan satisfied: per-type counts and marks');
      assert.throws(() => parseResponse(three.replace('"marks":2,"type":"Short","answer":"y"', '"marks":1,"type":"Short","answer":"y"'), { ...P, totalMarks: 4 }), /worth 1 marks, expected 2/); n++;
      assert.throws(() => parseResponse(three.replace('"type":"Short","answer":"y"', '"type":"MCQ","options":["a","b","c","d"],"answer":"a"'), P), /Expected 1 "Multiple Choice Questions" questions, got 2/); n++;
      const bad = await j('/', { method: 'POST', body: JSON.stringify({ title: 't', subject: 's', dueDate: '2026-10-20', questionTypes: ['x'], numberOfQuestions: 3, totalMarks: 9, questionPlan: P.questionPlan }) });
      ok(bad.status === 400, 'route rejects a plan that does not add up');
    }
    assert.throws(() => parseResponse(good.replace('Q1?', 'What is the main function of mitochondria?').replace('Q2?', 'What is the main function of the mitochondria?'), A), /near duplicates/); n++;
    assert.throws(() => parseResponse(good.replace(/"text":"Q1\?"/, '"text":"Q1?","concept": "cell powerhouse role"').replace(/"text":"Q2\?"/, '"text":"Q2?","concept": "role of cell powerhouse"'), A), /same concept/); n++;
    assert.throws(() => parseResponse(good, { ...A, numberOfQuestions: 3 }), /expected 3/); n++;
    assert.throws(() => parseResponse(good.replace('"Short"', '"Long"'), A), /not requested/); n++;
    assert.throws(() => parseResponse(good.replace('"answer":"b"', '"answer":"z"'), A), /not one of its options/); n++;
    assert.throws(() => parseResponse(good, { ...A, totalMarks: 6 }), /expected 6/); n++;
    assert.throws(() => parseResponse(good, { ...A, questionTypes: ['Multiple Choice Questions', 'Short Questions', 'Essay'] }), /Essay|essay/); n++;
  }
  assert.throws(() => resolveOpenRouterModels({ OPENROUTER_MODEL: 'a:free,paid/model' } as any)); n++;
  ok(!redactError('bad key sk-abcdefgh12345 Bearer xyz SECRETKEY', 'SECRETKEY').includes('SECRETKEY') && !redactError('x sk-abcdefgh12345').includes('sk-abcdefgh12345'), 'error redaction');
  assert.throws(() => resolveOpenRouterModel({ OPENROUTER_MODEL: 'meta-llama/llama-3.3-70b-instruct' } as any)); n++;
  const L = [{ name: 'Groq' }, { name: 'Gemini' }, { name: 'Cohere' }];
  ok(allowedProviders(L, {} as any).length === 3 && allowedProviders(L, { AI_PROVIDER_ALLOWLIST: ' gemini ' } as any).map((x) => x.name).join() === 'Gemini' && allowedProviders(L, { AI_PROVIDER_ALLOWLIST: 'none' } as any).length === 0, 'provider allowlist: unset=all, named=only those');
  ok(shouldRunWorkerInWeb({ WORKER_IN_WEB: 'true' } as any), 'worker-in-web only with explicit true');
  // auth routes
  const authRouter = (await import('../src/routes/auth')).default;
  const app2 = express(); app2.use(express.json()); app2.use('/api/auth', authRouter);
  const srv2 = app2.listen(0); const ab = `http://127.0.0.1:${(srv2.address() as AddressInfo).port}/api/auth`;
  const aj = async (u: string, body?: any, token?: string) => { const x = await fetch(ab + u, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: x.status, body: await x.json() as any }; };
  let a = await aj('/register', { email: 'Teacher@Example.com', password: 'short' }); ok(a.status === 400, 'short password rejected');
  a = await aj('/register', { email: 'Teacher@Example.com', password: 'longenough1' }); ok(a.status === 201 && a.body.data.user.email === 'teacher@example.com' && !!a.body.data.token, 'register lowercases email, returns token');
  const utok = a.body.data.token;
  a = await aj('/register', { email: 'teacher@example.com', password: 'longenough1' }); ok(a.status === 409, 'duplicate email 409');
  a = await aj('/login', { email: 'teacher@example.com', password: 'wrongwrong' }); ok(a.status === 401, 'wrong password 401');
  a = await aj('/login', { email: 'teacher@example.com', password: 'longenough1' }); ok(a.status === 200 && !!a.body.data.token, 'login ok');
  a = await aj('/me', undefined, utok); ok(a.status === 200 && a.body.data.email === 'teacher@example.com', 'me with token');
  a = await aj('/me'); ok(a.status === 401, 'me without token 401');
  srv2.close(); srv.close(); console.log(`api+worker tests passed (${n} assertions) on PGlite`);
})().catch((e) => { console.error(e); process.exit(1); });
