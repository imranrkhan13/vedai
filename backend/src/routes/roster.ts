import crypto from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDb } from '../services/db';
import { Assignment, IQuestion } from '../models/Assignment';
import { requireAuth, signToken, verifyToken } from '../services/auth';
import { jevEnabled, jevKeyReady, JEV_FIXTURES, JEV_MAX_PER_PAPER, takeDailySlot, jevScore, DEMO_KEY_POINTS, checklist, PILOT_MAX_CALLS, PILOT_MAX_USD, estInputTokens, estCostUsd, keyPointsFromKey, checklistFrom } from '../services/jev';
import { cleanAgeGroup, feedbackFor, realAnswerAiGate } from '../services/feedback';
import { getRedis } from '../services/redis';

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
async function insertStudent(assignmentId: string, ownerId: string, studentId: string, name: string | null, ageGroup = 'unknown'): Promise<{ id: string; code: string } | 'dup'> {
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      const { rows } = await getDb().query(
        'INSERT INTO vedai_students (assignment_id, owner_id, student_code, name, access_hash, age_group) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [assignmentId, ownerId, studentId, name, hashCode(code), cleanAgeGroup(ageGroup)]
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
  ageGroup: z.enum(['under18', 'adult', 'unknown']).optional(),
});

teacherRoster.get('/:aid', async (req: Request, res: Response) => {
  try {
    const a = await ownedAssignment(req, res); if (!a) return;
    const { rows } = await getDb().query(
      `SELECT s.id, s.student_code, s.name, s.age_group, s.ai_consent, s.created_at, b.submitted_at, b.late, b.released, b.marks
         FROM vedai_students s LEFT JOIN vedai_submissions b ON b.student_row_id = s.id
        WHERE s.assignment_id = $1 AND s.owner_id = $2 ORDER BY s.student_code`, [a._id, req.userId]);
    const max = flatQuestions(a).reduce((n, q) => n + q.marks, 0);
    return res.json({ success: true, data: { totalMarks: max, students: rows.map((r) => ({ id: r.id, studentId: r.student_code, name: r.name || '', ageGroup: r.age_group, aiConsent: !!r.ai_consent, submitted: !!r.submitted_at, submittedAt: r.submitted_at, late: !!r.late, released: !!r.released, markedTotal: r.submitted_at ? totalMarks(r.marks) : null })) } });
  } catch { return res.status(500).json({ success: false, error: 'Failed to load students' }); }
});

teacherRoster.post('/:aid', async (req: Request, res: Response) => {
  try {
    const p = AddSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ success: false, error: p.error.issues[0]?.message || 'Invalid student' });
    const a = await ownedAssignment(req, res); if (!a) return;
    const c = await getDb().query('SELECT count(*)::int AS n FROM vedai_students WHERE assignment_id=$1', [a._id]);
    if (c.rows[0].n >= MAX_STUDENTS) return res.status(400).json({ success: false, error: `Up to ${MAX_STUDENTS} students per assignment` });
    const r = await insertStudent(a._id, req.userId!, p.data.studentId, p.data.name ? strip(p.data.name) : null, p.data.ageGroup);
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

teacherRoster.patch('/:aid/:sid/age-group', async (req: Request, res: Response) => {
  try {
    const p = z.object({ ageGroup: z.enum(['under18', 'adult', 'unknown']) }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ success: false, error: 'Choose under 18, 18 or over, or not set.' });
    const o = await ownedStudent(req, res); if (!o) return;
    // Changing the group clears any earlier AI agreement: consent belongs to an adult who gave it.
    await getDb().query('UPDATE vedai_students SET age_group=$2, ai_consent=false WHERE id=$1', [o.s.id, p.data.ageGroup]);
    return res.json({ success: true, data: { ageGroup: p.data.ageGroup } });
  } catch { return res.status(500).json({ success: false, error: 'Could not save' }); }
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
    const preview: Record<string, any> = {};
    for (const q of flatQuestions(o.a)) { const f = feedbackFor(o.s.age_group, q.marks, (b?.marks || {})[q.id]); if (f) preview[q.id] = f; }
    return res.json({ success: true, data: { student: { id: o.s.id, studentId: o.s.student_code, name: o.s.name || '', ageGroup: o.s.age_group, aiConsent: !!o.s.ai_consent, aiGate: realAnswerAiGate(o.s).why }, questions, submitted: !!b, submittedAt: b?.submitted_at || null, late: !!b?.late, answers: b?.answers || {}, marks: b?.marks || {}, released: !!b?.released, draft: draftView(b?.draft), preview } });
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

function draftView(d: any) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(d || {}) as [string, any][]) {
    if (v.state === 'pending' && Date.now() - new Date(v.at).getTime() > 120000) out[k] = { state: 'failed', note: 'The draft took too long. Mark by hand.' };
    else out[k] = v;
  }
  return out;
}
// ---- Automatic AI DRAFT for the built-in synthetic demo only ----
// Sent to Jev ONLY when ALL hold: JEV is on, the paper is the one approved demo paper, the owner is the approved demo account,
// the question is the 3-level photosynthesis question, and the saved answer is exactly one of the server-fixed SYNTHETIC answers.
// Anything else is never sent. The draft is for the teacher only; it is never marks, never shown to the student.
export function draftEligible(a: any, ownerId: string, q: IQuestion, answer: string): { ok: boolean; why?: string } {
  if (!jevEnabled()) return { ok: false, why: 'AI draft is switched off' };
  if (ownerId !== process.env.JEV_DEMO_USER_ID || a._id !== process.env.JEV_DEMO_ASSIGNMENT_ID) return { ok: false, why: 'AI draft only runs on the approved demo paper' };
  if (!q.rubric || q.rubric.length !== 3 || !/photosynthesis/i.test(q.text)) return { ok: false, why: 'This question has no matching built-in demo answer' };
  if (!Object.values(JEV_FIXTURES).includes(answer)) return { ok: false, why: 'AI draft only works on the built-in synthetic demo answers. This answer was not sent to any AI service.' };
  return { ok: true };
}
// ---- Consented single-student pilot: a REAL typed answer from one named adult student who ticked consent. ----
export function pilotEligible(student: any, a: any, q: IQuestion, answer: string): { ok: boolean; why?: string } {
  if (!jevKeyReady()) return { ok: false, why: 'AI draft is switched off' };
  const g = realAnswerAiGate(student); if (!g.allowed) return { ok: false, why: g.why };
  if (!q.rubric || q.rubric.length < 2 || !q.answer || Object.keys(keyPointsFromKey(q.answer).checks).length < 2) return { ok: false, why: 'This question has no usable marking guide and answer key for an AI draft.' };
  if (answer.trim().length < 10 || answer.length > 2000) return { ok: false, why: 'Answer too short or too long for the pilot.' };
  return { ok: true };
}
async function runPilotDraft(student: any, q: IQuestion, answer: string): Promise<void> {
  const save = async (d: any) => { await getDb().query("UPDATE vedai_submissions SET draft = jsonb_set(draft, ARRAY[$2]::text[], $3::jsonb), updated_at=now() WHERE student_row_id=$1", [student.id, q.id, JSON.stringify({ pilot: true, ...d })]); };
  try {
    const asc = [...(q.rubric || [])].sort((x, y) => x.marks - y.marks).map((l) => ({ marks: Math.min(l.marks, q.marks), descriptor: l.descriptor }));
    const { checks, labels } = keyPointsFromKey(q.answer || '');
    const instr = 'How well does `student_answer` answer `exam_question`? Judge it only against the levels.';
    const cost = estCostUsd(estInputTokens({ state: { exam_question: q.text, student_answer: answer }, instr, criteria: asc.map((l) => l.descriptor), checks }));
    // Hard ceiling, reserved atomically BEFORE the request: at most PILOT_MAX_CALLS requests and PILOT_MAX_USD estimated (over-counted) spend for this student.
    const rsv = await getDb().query('UPDATE vedai_students SET pilot_calls = pilot_calls + 1, pilot_cost_usd = pilot_cost_usd + $2 WHERE id=$1 AND pilot_calls < $3 AND pilot_cost_usd + $2 <= $4 RETURNING pilot_calls', [student.id, cost, PILOT_MAX_CALLS, PILOT_MAX_USD]);
    if (!(rsv.rowCount ?? 0)) return await save({ state: 'failed', note: 'Pilot request or spend limit reached. Mark by hand.', at: new Date().toISOString() });
    if (!(await takeDailySlot())) return await save({ state: 'failed', note: 'Daily limit reached. Mark by hand.', at: new Date().toISOString() });
    let r;
    try { r = await jevScore({ exam_question: q.text, student_answer: answer }, instr, asc.map((l) => l.descriptor), checks); }
    catch { return await save({ state: 'failed', note: 'The grading service did not return a usable answer. Mark by hand.', at: new Date().toISOString() }); }
    let best = 0; let bp = -1;
    for (let i = 0; i < asc.length; i++) { const p = Number(r.probabilities[String(i)] ?? 0); if (p > bp) { bp = p; best = i; } }
    await save({ state: 'done', marks: asc[best].marks, levelIndex: best, guideText: asc[best].descriptor, confidence: r.confidence, model: r.model, checklist: checklistFrom(labels, r.nouls), at: new Date().toISOString() });
  } catch { try { await save({ state: 'failed', note: 'Draft could not be made. Mark by hand.', at: new Date().toISOString() }); } catch { /* ignore */ } }
}
async function runDraft(submissionStudentRowId: string, assignmentId: string, ownerId: string, q: IQuestion, answer: string): Promise<void> {
  const save = async (d: any) => {
    await getDb().query("UPDATE vedai_submissions SET draft = jsonb_set(draft, ARRAY[$2]::text[], $3::jsonb), updated_at=now() WHERE student_row_id=$1", [submissionStudentRowId, q.id, JSON.stringify(d)]);
  };
  try {
    const a = await Assignment.findById(assignmentId, ownerId);
    if (!a || !a.output) return await save({ state: 'failed', note: 'Paper not found. Mark by hand.', at: new Date().toISOString() });
    if ((a.output.gradeCalls || 0) >= JEV_MAX_PER_PAPER) return await save({ state: 'failed', note: 'Demo limit reached for this paper. Mark by hand.', at: new Date().toISOString() });
    if (!(await takeDailySlot())) return await save({ state: 'failed', note: 'Demo daily limit reached. Mark by hand.', at: new Date().toISOString() });
    a.output.gradeCalls = (a.output.gradeCalls || 0) + 1;
    await Assignment.setOutputForOwner(a._id, ownerId, a.output);
    const asc = [...(q.rubric || [])].sort((x, y) => x.marks - y.marks).map((l) => ({ marks: Math.min(l.marks, q.marks), descriptor: l.descriptor }));
    let r;
    try {
      r = await jevScore({ exam_question: q.text, student_answer: answer }, 'How well does `student_answer` answer `exam_question`? Judge it only against the levels.', asc.map((l) => l.descriptor), DEMO_KEY_POINTS);
    } catch { return await save({ state: 'failed', note: 'The grading service did not return a usable answer. Mark by hand.', at: new Date().toISOString() }); }
    let best = 0; let bp = -1;
    for (let i = 0; i < asc.length; i++) { const p = Number(r.probabilities[String(i)] ?? 0); if (p > bp) { bp = p; best = i; } }
    await save({ state: 'done', marks: asc[best].marks, levelIndex: best, guideText: asc[best].descriptor, confidence: r.confidence, model: r.model, checklist: checklist(r.nouls), at: new Date().toISOString() });
    await getRedis().del(`assignment:${assignmentId}`);
  } catch { try { await save({ state: 'failed', note: 'Draft could not be made. Mark by hand.', at: new Date().toISOString() }); } catch { /* ignore */ } }
}

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
    const feedback: Record<string, any> = {};
    if (released) for (const q of qs) { const f = feedbackFor(s.age_group, q.marks, (b.marks || {})[q.id]); if (f) feedback[q.id] = f; }
    return res.json({ success: true, data: {
      student: { studentId: s.student_code, name: s.name || '', ageGroup: s.age_group, aiConsent: !!s.ai_consent, aiPilot: !!s.id && process.env.REAL_ANSWER_AI_STUDENT === s.id },
      assignment: { title: a.title, subject: a.subject, dueDate: a.dueDate, totalMarks: qs.reduce((n, q) => n + q.marks, 0), questions },
      submission: b ? { submitted: true, submittedAt: b.submitted_at, late: !!b.late, answers: b.answers || {}, released, marks: released ? b.marks || {} : null, total: released ? totalMarks(b.marks) : null, feedback: released ? feedback : null } : { submitted: false },
    } });
  } catch { return res.status(500).json({ success: false, error: 'Failed to load' }); }
});

// An adult student may record whether they agree to send a typed answer to an AI service. Under 18 and unset cannot. Recording it does not switch anything on.
studentPortal.post('/consent', requireStudent, async (req: Request, res: Response) => {
  const p = z.object({ agree: z.boolean() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ success: false, error: 'Invalid' });
  if (req.studentRow.age_group !== 'adult') return res.status(403).json({ success: false, error: 'Your teacher has not marked you as 18 or over.' });
  await getDb().query('UPDATE vedai_students SET ai_consent=$2 WHERE id=$1', [req.studentRow.id, p.data.agree]);
  return res.json({ success: true, data: { aiConsent: p.data.agree } });
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
    // automatic AI draft (synthetic demo only). Submission is already saved; the draft runs after and never blocks or changes it.
    const pil = flatQuestions(a).filter((q) => answers[q.id] !== undefined && pilotEligible(s, a, q, answers[q.id]).ok);
    for (const q of pil) {
      await getDb().query("UPDATE vedai_submissions SET draft = jsonb_set(draft, ARRAY[$2]::text[], $3::jsonb) WHERE student_row_id=$1", [s.id, q.id, JSON.stringify({ state: 'pending', pilot: true, at: new Date().toISOString() })]);
    }
    if (pil.length) void (async () => { for (const q of pil) await runPilotDraft(s, q, answers[q.id]); })();
    const eligible = flatQuestions(a).filter((q) => answers[q.id] !== undefined && draftEligible(a, s.owner_id, q, answers[q.id]).ok);
    if (eligible.length) {
      const q = eligible[0];
      await getDb().query("UPDATE vedai_submissions SET draft = jsonb_set(draft, ARRAY[$2]::text[], $3::jsonb) WHERE student_row_id=$1", [s.id, q.id, JSON.stringify({ state: 'pending', at: new Date().toISOString() })]);
      void runDraft(s.id, s.assignment_id, s.owner_id, q, answers[q.id]);
    }
    return res.status(201).json({ success: true, data: { submitted: true, late } });
  } catch { return res.status(500).json({ success: false, error: 'Could not submit' }); }
});
