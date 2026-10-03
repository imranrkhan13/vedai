import crypto from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb } from '../services/db';
import { Assignment, IQuestion } from '../models/Assignment';
import { requireAuth, signToken, verifyToken } from '../services/auth';

// Student portal: the teacher adds students to one assignment and gives each a teacher-chosen student ID.
// The ID alone is NOT a login. The server also makes a random access code per student (shown to the teacher once, only a keyed hash is stored).
// Student answers are stored in our own database and are never sent to any AI service. Marks are entered by the teacher by hand.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function keyBytes(): Buffer {
  return crypto.createHash('sha256').update(`vedai-student:${process.env.AUTH_SECRET || process.env.DATABASE_URL || 'dev-only-secret'}`).digest();
}
const hashCode = (code: string) => crypto.createHmac('sha256', keyBytes()).update(code).digest('hex');
const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
function newCode(): string {
  const b = crypto.randomBytes(10);
  let s = '';
  for (let i = 0; i < 10; i++) s += ALPHABET[b[i] % 32];
  return s;
}
const showCode = (c: string) => `${c.slice(0, 5)}-${c.slice(5)}`;

const UUID_RE = /^[0-9a-f-]{36}$/i;
const strip = (s: string) => s.replace(/\u0000/g, '');
const MAX_STUDENTS = 200;
const MAX_ANSWER = 5000;
const MAX_TOTAL = 40000;

function flatQuestions(a: { output?: { sections: { questions: IQuestion[] }[] } }): IQuestion[] {
  return (a.output?.sections || []).flatMap((s) => s.questions);
}
async function ownedAssignment(req: Request, res: Response) {
  const a = await Assignment.findById(req.params.aid as string, req.userId!);
  if (!a || a.status !== 'completed' || !a.output) { res.status(404).json({ success: false, error: 'Not found' }); return null; }
  return a;
}
async function insertStudent(assignmentId: string, ownerId: string, studentId: string, name: string | null): Promise<{ id: string; code: string } | 'dup'> {
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      const { rows } = await getDb().query(
        'INSERT INTO vedai_students (assignment_id, owner_id, student_code, name, access_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [assignmentId, ownerId, studentId, name, hashCode(code)]
      );
      return { id: rows[0].id, code };
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/access_hash/.test(msg)) continue; // vanishingly rare code collision: draw again
      if (/duplicate|unique/i.test(msg)) return 'dup';
      throw e;
    }
  }
  throw new Error('code');
}
function totalMarks(marks: Record<string, { marks: number }> | null): number {
  return Object.values(marks || {}).reduce((n, m) => n + (m.marks || 0), 0);
}

// ---------------- Teacher side: /api/roster ----------------
export const teacherRoster = Router();
teacherRoster.use(requireAuth);

const AddSchema = z.object({
  studentId: z.string().trim().regex(/^[A-Za-z0-9._-]{1,32}$/, 'Use letters, numbers, dot, dash or underscore, up to 32 characters, no spaces'),
  name: z.string().trim().max(60).optional(),
});

teacherRoster.get('/:aid', async (req: Request, res: Response) => {
  try {
    const a = await ownedAssignment(req, res); if (!a) return;
    const { rows } = await getDb().query(
      `SELECT s.id, s.student_code, s.name, s.created_at, b.submitted_at, b.late, b.released, b.marks
         FROM vedai_students s LEFT JOIN vedai_submissions b ON b.student_row_id = s.id
        WHERE s.assignment_id = $1 AND s.owner_id = $2 ORDER BY s.student_code`, [a._id, req.userId]);
    const max = flatQuestions(a).reduce((n, q) => n + q.marks, 0);
    return res.json({ success: true, data: { totalMarks: max, students: rows.map((r) => ({ id: r.id, studentId: r.student_code, name: r.name || '', submitted: !!r.submitted_at, submittedAt: r.submitted_at, late: !!r.late, released: !!r.released, markedTotal: r.submitted_at ? totalMarks(r.marks) : null })) } });
  } catch { return res.status(500).json({ success: false, error: 'Failed to load students' }); }
});

teacherRoster.post('/:aid', async (req: Request, res: Response) => {
  try {
    const p = AddSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ success: false, error: p.error.issues[0]?.message || 'Invalid student' });
    const a = await ownedAssignment(req, res); if (!a) return;
    const c = await getDb().query('SELECT count(*)::int AS n FROM vedai_students WHERE assignment_id=$1', [a._id]);
    if (c.rows[0].n >= MAX_STUDENTS) return res.status(400).json({ success: false, error: `Up to ${MAX_STUDENTS} students per assignment` });
    const r = await insertStudent(a._id, req.userId!, p.data.studentId, p.data.name ? strip(p.data.name) : null);
    if (r === 'dup') return res.status(409).json({ success: false, error: 'That student ID is already on this assignment' });
    return res.status(201).json({ success: true, data: { id: r.id, studentId: p.data.studentId, accessCode: showCode(r.code) } });
  } catch { return res.status(500).json({ success: false, error: 'Could not add student' }); }
});

async function ownedStudent(req: Request, res: Response) {
  const a = await ownedAssignment(req, res); if (!a) return null;
  const sid = req.params.sid as string;
  if (!UUID_RE.test(sid)) { res.status(404).json({ success: false, error: 'Not found' }); return null; }
  const { rows } = await getDb().query('SELECT * FROM vedai_students WHERE id=$1 AND assignment_id=$2 AND owner_id=$3', [sid, a._id, req.userId]);
  if (!rows[0]) { res.status(404).json({ success: false, error: 'Not found' }); return null; }
  return { a, s: rows[0] };
}

teacherRoster.post('/:aid/:sid/reset', async (req: Request, res: Response) => {
  try {
    const o = await ownedStudent(req, res); if (!o) return;
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      try {
        await getDb().query('UPDATE vedai_students SET access_hash=$2 WHERE id=$1', [o.s.id, hashCode(code)]);
        return res.json({ success: true, data: { accessCode: showCode(code) } });
      } catch (e: any) { if (!/access_hash|unique|duplicate/i.test(String(e?.message))) throw e; }
    }
    throw new Error('code');
  } catch { return res.status(500).json({ success: false, error: 'Could not reset the code' }); }
});

teacherRoster.delete('/:aid/:sid', async (req: Request, res: Response) => {
  try {
    const o = await ownedStudent(req, res); if (!o) return;
    await getDb().query('DELETE FROM vedai_submissions WHERE student_row_id=$1', [o.s.id]);
    await getDb().query('DELETE FROM vedai_students WHERE id=$1', [o.s.id]);
    return res.json({ success: true });
  } catch { return res.status(500).json({ success: false, error: 'Could not remove student' }); }
});

teacherRoster.get('/:aid/:sid', async (req: Request, res: Response) => {
  try {
    const o = await ownedStudent(req, res); if (!o) return;
    const { rows } = await getDb().query('SELECT * FROM vedai_submissions WHERE student_row_id=$1', [o.s.id]);
    const b = rows[0];
    const questions = flatQuestions(o.a).map((q, i) => ({ id: q.id, number: i + 1, text: q.text, marks: q.marks, type: q.type, options: q.options || [], answerKey: q.answer || '', rubric: q.rubric || [] }));
    return res.json({ success: true, data: { student: { id: o.s.id, studentId: o.s.student_code, name: o.s.name || '' }, questions, submitted: !!b, submittedAt: b?.submitted_at || null, late: !!b?.late, answers: b?.answers || {}, marks: b?.marks || {}, released: !!b?.released } });
  } catch { return res.status(500).json({ success: false, error: 'Failed to load' }); }
});

const MarkSchema = z.object({ questionId: z.string().min(1).max(100), marks: z.number().int().min(0).max(1000), reason: z.string().max(500).optional() });
teacherRoster.patch('/:aid/:sid/marks', async (req: Request, res: Response) => {
  try {
    const p = MarkSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ success: false, error: 'Marks must be a whole number.' });
    const o = await ownedStudent(req, res); if (!o) return;
    const q = flatQuestions(o.a).find((x) => x.id === p.data.questionId);
    if (!q) return res.status(404).json({ success: false, error: 'Not found' });
    if (p.data.marks > q.marks) return res.status(400).json({ success: false, error: `Marks cannot be more than the question maximum of ${q.marks}.` });
    const { rows } = await getDb().query('SELECT marks FROM vedai_submissions WHERE student_row_id=$1', [o.s.id]);
    if (!rows[0]) return res.status(409).json({ success: false, error: 'This student has not submitted yet' });
    const marks = { ...(rows[0].marks || {}), [q.id]: { marks: p.data.marks, reason: strip(p.data.reason || ''), at: new Date().toISOString() } };
    await getDb().query('UPDATE vedai_submissions SET marks=$2::jsonb, updated_at=now() WHERE student_row_id=$1', [o.s.id, JSON.stringify(marks)]);
    return res.json({ success: true, data: { questionId: q.id, marks: p.data.marks, total: totalMarks(marks) } });
  } catch { return res.status(500).json({ success: false, error: 'Failed to save' }); }
});

teacherRoster.post('/:aid/:sid/release', async (req: Request, res: Response) => {
  try {
    const o = await ownedStudent(req, res); if (!o) return;
    const rel = req.body?.released === true;
    const r = await getDb().query('UPDATE vedai_submissions SET released=$2, updated_at=now() WHERE student_row_id=$1', [o.s.id, rel]);
    if (!(r.rowCount ?? 0)) return res.status(409).json({ success: false, error: 'This student has not submitted yet' });
    return res.json({ success: true, data: { released: rel } });
  } catch { return res.status(500).json({ success: false, error: 'Failed' }); }
});

// ---------------- Student side: /api/student ----------------
export const studentPortal = Router();
const SCOOKIE = 'qx_student';
const secureCookie = (req: Request) => process.env.NODE_ENV === 'production' || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
const TTL = 12 * 3600;

const hits = new Map<string, number[]>();
function limited(key: string, max: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 15 * 60_000);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now); hits.set(key, arr); return false;
}
function clientIp(req: Request): string {
  const xf = String(req.headers['x-forwarded-for'] || req.ip || '').split(',').map((x) => x.trim());
  return xf.length >= 2 ? xf[xf.length - 2] : xf[0];
}
function cookieOf(req: Request): string | null {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === SCOOKIE) return v.join('=');
  }
  return null;
}
declare module 'express-serve-static-core' { interface Request { studentRow?: any } }

async function requireStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const c = cookieOf(req);
    const uid = c ? verifyToken(c, 'student') : null;
    const safe = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
    if (uid && !safe && req.headers['x-requested-with'] !== 'quillix') return res.status(403).json({ success: false, error: 'Blocked request' });
    const [rowId, tag] = (uid || '').split('.');
    if (!rowId || !tag || !UUID_RE.test(rowId)) return res.status(401).json({ success: false, error: 'Please sign in' });
    const { rows } = await getDb().query('SELECT * FROM vedai_students WHERE id=$1', [rowId]);
    // The session carries a prefix of the current access-code hash, so resetting a code ends old sessions.
    if (!rows[0] || rows[0].access_hash.slice(0, 12) !== tag) return res.status(401).json({ success: false, error: 'Please sign in' });
    req.studentRow = rows[0];
    next();
  } catch { return res.status(500).json({ success: false, error: 'Failed' }); }
}

studentPortal.post('/login', async (req: Request, res: Response) => {
  try {
    const sid = typeof req.body?.studentId === 'string' ? req.body.studentId.trim().slice(0, 40) : '';
    const code = typeof req.body?.accessCode === 'string' ? normCode(req.body.accessCode).slice(0, 40) : '';
    if (limited(`ip:${clientIp(req)}`, 30) || limited(`id:${sid.toLowerCase()}`, 10)) return res.status(429).json({ success: false, error: 'Too many attempts. Try again in a few minutes.' });
    if (!sid || code.length !== 10) return res.status(401).json({ success: false, error: 'Check your student ID and access code' });
    const h = hashCode(code);
    const { rows } = await getDb().query('SELECT * FROM vedai_students WHERE access_hash=$1', [h]);
    const s = rows[0];
    if (!s || s.student_code.toLowerCase() !== sid.toLowerCase()) return res.status(401).json({ success: false, error: 'Check your student ID and access code' });
    const tok = signToken(`${s.id}.${s.access_hash.slice(0, 12)}`, TTL, 'student');
    res.setHeader('Set-Cookie', `${SCOOKIE}=${tok}; Max-Age=${TTL}; Path=/; HttpOnly; SameSite=Lax${secureCookie(req) ? '; Secure' : ''}`);
    return res.json({ success: true, data: { student: { studentId: s.student_code, name: s.name || '' } } });
  } catch { return res.status(500).json({ success: false, error: 'Could not sign in' }); }
});

studentPortal.post('/logout', (req: Request, res: Response) => {
  res.setHeader('Set-Cookie', `${SCOOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secureCookie(req) ? '; Secure' : ''}`);
  res.json({ success: true, data: {} });
});

// Only what a student may see: question text, marks, options. Never the answer key, source sentences or marking levels.
studentPortal.get('/me', requireStudent, async (req: Request, res: Response) => {
  try {
    const s = req.studentRow;
    const a = await Assignment.findById(s.assignment_id);
    if (!a || a.status !== 'completed' || !a.output) return res.status(404).json({ success: false, error: 'This assignment is not available' });
    const { rows } = await getDb().query('SELECT * FROM vedai_submissions WHERE student_row_id=$1', [s.id]);
    const b = rows[0];
    const qs = flatQuestions(a);
    const questions = qs.map((q, i) => ({ id: q.id, number: i + 1, text: q.text, marks: q.marks, type: q.type, options: q.options || [] }));
    const released = !!b?.released;
    return res.json({ success: true, data: {
      student: { studentId: s.student_code, name: s.name || '' },
      assignment: { title: a.title, subject: a.subject, dueDate: a.dueDate, totalMarks: qs.reduce((n, q) => n + q.marks, 0), questions },
      submission: b ? { submitted: true, submittedAt: b.submitted_at, late: !!b.late, answers: b.answers || {}, released, marks: released ? b.marks || {} : null, total: released ? totalMarks(b.marks) : null } : { submitted: false },
    } });
  } catch { return res.status(500).json({ success: false, error: 'Failed to load' }); }
});

const SubmitSchema = z.object({ answers: z.record(z.string().max(100), z.string().max(MAX_ANSWER)) });
studentPortal.post('/submit', requireStudent, async (req: Request, res: Response) => {
  try {
    const p = SubmitSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ success: false, error: `Each answer can be up to ${MAX_ANSWER} characters.` });
    const s = req.studentRow;
    const a = await Assignment.findById(s.assignment_id);
    if (!a || a.status !== 'completed' || !a.output) return res.status(404).json({ success: false, error: 'This assignment is not available' });
    const ids = new Set(flatQuestions(a).map((q) => q.id));
    const answers: Record<string, string> = {};
    let total = 0;
    for (const [k, v] of Object.entries(p.data.answers)) {
      if (!ids.has(k)) return res.status(400).json({ success: false, error: 'Unknown question' });
      const t = strip(v).trim();
      if (t) { answers[k] = t; total += t.length; }
    }
    if (!Object.keys(answers).length) return res.status(400).json({ success: false, error: 'Write at least one answer before submitting.' });
    if (total > MAX_TOTAL) return res.status(400).json({ success: false, error: 'Your answers are too long in total.' });
    const late = new Date(a.dueDate).getTime() < Date.now();
    const r = await getDb().query(
      'INSERT INTO vedai_submissions (student_row_id, assignment_id, owner_id, answers, late) VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT (student_row_id) DO NOTHING',
      [s.id, s.assignment_id, s.owner_id, JSON.stringify(answers), late]);
    if (!(r.rowCount ?? 0)) return res.status(409).json({ success: false, error: 'You have already submitted. Ask your teacher if you need to change something.' });
    return res.status(201).json({ success: true, data: { submitted: true, late } });
  } catch { return res.status(500).json({ success: false, error: 'Could not submit' }); }
});
