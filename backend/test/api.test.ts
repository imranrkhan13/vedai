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
  const j = async (u: string, o?: RequestInit) => { const r = await fetch(base + u, { headers: { 'Content-Type': 'application/json' }, ...o }); return { status: r.status, body: await r.json() as any }; };
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

  r = await j(`/${id}/regenerate`, { method: 'POST', body: JSON.stringify({ clientId: 'c1' }) });
  ok(r.status === 200 && jobs.length === 2 && !cache.has('assignment:' + id), 'regenerate queues job, clears cache');
  r = await j('/' + id); ok(r.body.data.status === 'pending' && r.body.data.output === undefined && r.body.data.jobId === '2', 'regenerate reset state');

  await processAssignmentJob({ id: '9', data: { assignmentId: '00000000-0000-0000-0000-000000000000' }, updateProgress: async () => {} } as any).then(() => assert.fail('should throw'), () => { n++; });
  r = await j('/not-a-uuid'); ok(r.status === 404, 'bad id 404');
  r = await j('/' + id, { method: 'DELETE' }); ok(r.body.success, 'delete ok');
  r = await j('/' + id); ok(r.status === 404, 'deleted -> 404');
  ok(!shouldRunWorkerInWeb({} as any) && !shouldRunWorkerInWeb({ WORKER_IN_WEB: 'false' } as any) && !shouldRunWorkerInWeb({ WORKER_IN_WEB: '1' } as any), 'worker-in-web off by default');
  const { allowedProviders, resolveOpenRouterModel } = await import('../src/services/aiGenerator');
  ok(resolveOpenRouterModel({ OPENROUTER_MODEL: 'google/gemma-4-31b-it:free' } as any) === 'google/gemma-4-31b-it:free' && resolveOpenRouterModel({} as any).endsWith(':free'), 'openrouter free model accepted/default is free');
  assert.throws(() => resolveOpenRouterModel({ OPENROUTER_MODEL: 'meta-llama/llama-3.3-70b-instruct' } as any)); n++;
  const L = [{ name: 'Groq' }, { name: 'Gemini' }, { name: 'Cohere' }];
  ok(allowedProviders(L, {} as any).length === 3 && allowedProviders(L, { AI_PROVIDER_ALLOWLIST: ' gemini ' } as any).map((x) => x.name).join() === 'Gemini' && allowedProviders(L, { AI_PROVIDER_ALLOWLIST: 'none' } as any).length === 0, 'provider allowlist: unset=all, named=only those');
  ok(shouldRunWorkerInWeb({ WORKER_IN_WEB: 'true' } as any), 'worker-in-web only with explicit true');
  srv.close(); console.log(`api+worker tests passed (${n} assertions) on PGlite`);
})().catch((e) => { console.error(e); process.exit(1); });
