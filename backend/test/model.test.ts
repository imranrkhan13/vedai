import { PGlite } from '@electric-sql/pglite';
import { setDb, initSchema } from '../src/services/db';
import { Assignment } from '../src/models/Assignment';
import assert from 'node:assert/strict';

(async () => {
  const pg = new PGlite();
  const db = { query: async (t: string, p?: unknown[]) => { const r = await pg.query(t, p as any[]); return { rows: r.rows as any[], rowCount: r.affectedRows ?? r.rows.length }; } };
  // PGlite can't run multi-statement with params; schema has none.
  await pg.exec((await import('../src/services/db')).SCHEMA_SQL);
  setDb(db);
  const a = await Assignment.create({ title: 'T', subject: 'Math', dueDate: new Date('2026-10-10'), questionTypes: ['MCQ','Short'], numberOfQuestions: 5, totalMarks: 20, difficulty: 'mixed', fileContent: 'abc' }, 'o1');
  assert.match(a._id, /^[0-9a-f-]{36}$/); assert.equal(a.status, 'pending'); assert.deepEqual(a.questionTypes, ['MCQ','Short']);
  await Assignment.setProcessing(a._id);
  const out = { subject: 'Math', totalMarks: 20, sections: [{ title: 'A', instruction: 'x', totalMarks: 20, questions: [{ id: '1', text: 'q', difficulty: 'easy' as const, marks: 20, type: 'MCQ' }] }], generatedAt: new Date() };
  await Assignment.setCompleted(a._id, out as any);
  const f = await Assignment.findById(a._id);
  assert.equal(f!.status, 'completed'); assert.equal(f!.output!.sections[0].questions[0].text, 'q'); assert.equal(f!.fileContent, 'abc');
  const l = await Assignment.list('o1'); assert.equal(l.length, 1); assert.equal(l[0].output, undefined); assert.equal(l[0].fileContent, undefined);
  await Assignment.resetForRegenerate(a._id); const r = await Assignment.findById(a._id); assert.equal(r!.status, 'pending'); assert.equal(r!.output, undefined);
  await Assignment.setFailed(a._id, 'boom'); assert.equal((await Assignment.findById(a._id))!.error, 'boom');
  assert.equal(await Assignment.findById('not-an-id'), null); assert.equal(await Assignment.findById(a._id, 'someone-else'), null); assert.equal((await Assignment.list('someone-else')).length, 0); assert.equal(await Assignment.deleteById(a._id, 'someone-else'), false);
  await Assignment.deleteById(a._id, 'o1'); assert.equal(await Assignment.findById(a._id), null);
  await assert.rejects(Assignment.create({ title: 'T', subject: 'S', dueDate: new Date(), questionTypes: [], numberOfQuestions: 0, totalMarks: 1, difficulty: 'mixed' }));
  const nul = await Assignment.create({ title: 'N\u0000T', subject: 'S', dueDate: new Date('2026-10-10'), questionTypes: ['MCQ'], numberOfQuestions: 1, totalMarks: 1, difficulty: 'mixed', fileContent: 'pd\u0000f' });
  assert.equal(nul.title, 'NT'); assert.equal(nul.fileContent, 'pdf');
  await Assignment.setCompleted(nul._id, { subject: 'a\u0000b', totalMarks: 1, sections: [], generatedAt: new Date() } as any);
  assert.equal((await Assignment.findById(nul._id))!.output!.subject, 'ab');
  await Assignment.deleteById(nul._id, 'o1');
  console.log('model tests passed (18 assertions) on PGlite (Postgres)');
})().catch((e) => { console.error(e); process.exit(1); });
