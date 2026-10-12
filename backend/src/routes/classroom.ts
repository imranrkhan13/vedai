import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { getDb } from '../services/db';
import { Assignment, IAssignment } from '../models/Assignment';
import { requireAuth, readCookie, cookieOptions, signToken, verifyToken, hashPassword, verifyPassword } from '../services/auth';
import { getAssignmentQueue } from '../services/queue';
export const rosterRoutes = Router();
export const studentRoutes = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);
const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
const send = (res: Response, data: unknown) => res.json({ success: true, data });
const questions = (a: IAssignment) => (a.output?.sections.flatMap(s => s.questions) || []).map((q, i) => ({ ...q, number: i + 1, options: q.options || [] }));
const total = (marks: Record<string, any>) => Object.values(marks).reduce((n, x) => n + x.marks, 0);
const code = () => crypto.randomBytes(12).toString('hex');
async function student(req: Request) {
 const uid = verifyToken(readCookie(req, 'vedai_student'));
 if (!uid?.startsWith('student:')) return null;
 const [, id, version] = uid.split(':');
 const { rows } = await getDb().query('SELECT * FROM vedai_students WHERE id=$1 AND session_version=$2', [id, Number(version)]);
 return rows[0] || null;
}
async function owned(req: Request) { return Assignment.findById(String(req.params.aid), req.userId!); }
async function rosterStudent(req: Request) { const { rows } = await getDb().query('SELECT * FROM vedai_students WHERE id=$1 AND assignment_id=$2', [req.params.sid, req.params.aid]); return rows[0]; }
const summary = (s: any, a: IAssignment) => ({ id: s.id, studentId: s.student_id, name: s.name, ageGroup: s.age_group, aiConsent: s.ai_consent, submitted: !!s.submitted_at, submittedAt: s.submitted_at, late: !!s.submitted_at && new Date(s.submitted_at) > new Date(a.dueDate), released: s.released, markedTotal: Object.keys(s.marks).length ? total(s.marks) : null });
rosterRoutes.use(requireAuth);
rosterRoutes.get('/:aid', wrap(async (req, res) => {
 const a = await owned(req); if (!a) return fail(res, 404, 'Assignment not found');
 const { rows } = await getDb().query('SELECT * FROM vedai_students WHERE assignment_id=$1 ORDER BY student_id', [a._id]);
 return send(res, { totalMarks: a.output?.totalMarks || a.totalMarks, students: rows.map(s => summary(s, a)) });
}));
rosterRoutes.post('/:aid', wrap(async (req, res) => {
 const a = await owned(req); if (!a) return fail(res, 404, 'Assignment not found');
 if (a.status !== 'completed') return fail(res, 409, 'Generate the question paper before assigning students');
 const p = z.object({ studentId: z.string().trim().min(1).max(80), name: z.string().trim().max(100).optional(), ageGroup: z.enum(['unknown', 'adult', 'under18']).default('unknown') }).safeParse(req.body);
 if (!p.success) return fail(res, 400, 'Enter a valid student ID and age group');
 const accessCode = code();
 const { rows } = await getDb().query('INSERT INTO vedai_students (assignment_id,student_id,name,code_hash,age_group) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (student_id) DO NOTHING RETURNING id', [a._id,p.data.studentId,p.data.name || '',hashPassword(accessCode),p.data.ageGroup]);
 if (!rows[0]) return fail(res, 409, 'This student ID is already assigned. Choose a unique ID for this paper.');
 return send(res, { id: rows[0].id, studentId: p.data.studentId, accessCode });
}));
rosterRoutes.get('/:aid/:sid', wrap(async (req, res) => {
 const a = await owned(req); const s = a && await rosterStudent(req); if (!a || !s) return fail(res, 404, 'Student not found');
 return send(res, { student: summary(s,a), questions: questions(a), answers: s.answers, marks: s.marks, aiDrafts: s.drafts, gradingError: s.grading_error, released: s.released, total: total(s.marks) });
}));
rosterRoutes.post('/:aid/:sid/grade', wrap(async (req, res) => {
 const a = await owned(req); const s = a && await rosterStudent(req); if (!a || !s) return fail(res, 404, 'Student not found');
 if (!s.submitted_at) return fail(res, 409, 'Student has not submitted');
 await getDb().query('UPDATE vedai_students SET grading_error=$2 WHERE id=$1', [s.id, 'Jev grading queued. Refresh this review shortly.']);
 await getAssignmentQueue().add('grade-submission', { studentId: s.id }, { jobId: `grade-${s.id}`, removeOnComplete: true, removeOnFail: true });
 return send(res, { queued: true });
}));
rosterRoutes.patch('/:aid/:sid/marks', wrap(async (req, res) => {
 const a = await owned(req); const s = a && await rosterStudent(req); if (!a || !s) return fail(res, 404, 'Student not found');
 const p = z.object({ questionId: z.string(), marks: z.number().int().nonnegative(), reason: z.string().max(2000) }).safeParse(req.body);
 const q = p.success && questions(a).find(q => q.id === p.data.questionId);
 if (!p.success || !q || p.data.marks > q.marks) return fail(res, 400, 'Marks must be within the question maximum');
 if (!s.submitted_at) return fail(res, 409, 'Student has not submitted');
 const mark = { [p.data.questionId]: { marks: p.data.marks, reason: p.data.reason } };
 const { rows } = await getDb().query('UPDATE vedai_students SET marks=marks || $2::jsonb WHERE id=$1 RETURNING marks', [s.id,JSON.stringify(mark)]);
 return send(res, { total: total(rows[0].marks) });
}));
rosterRoutes.post('/:aid/:sid/release', wrap(async (req, res) => {
 const a = await owned(req); const s = a && await rosterStudent(req); if (!a || !s) return fail(res, 404, 'Student not found');
 if (typeof req.body.released !== 'boolean') return fail(res, 400, 'Invalid release value');
 if (req.body.released && questions(a).some(q => !s.marks[q.id])) return fail(res, 409, 'Save marks for every question before sharing');
 await getDb().query('UPDATE vedai_students SET released=$2 WHERE id=$1', [s.id,req.body.released]); return send(res, {});
}));
rosterRoutes.post('/:aid/:sid/reset', wrap(async (req,res) => {
 if (!await owned(req)) return fail(res,404,'Assignment not found'); const s = await rosterStudent(req); if (!s) return fail(res,404,'Student not found');
 const accessCode = code(); await getDb().query('UPDATE vedai_students SET code_hash=$2,session_version=session_version+1 WHERE id=$1', [s.id,hashPassword(accessCode)]); return send(res,{accessCode});
}));
rosterRoutes.patch('/:aid/:sid/age-group', wrap(async (req,res) => {
 if (!await owned(req)) return fail(res,404,'Assignment not found'); const s = await rosterStudent(req); if (!s) return fail(res,404,'Student not found');
 const p = z.enum(['unknown','adult','under18']).safeParse(req.body.ageGroup); if (!p.success) return fail(res,400,'Invalid age group');
 await getDb().query('UPDATE vedai_students SET age_group=$2 WHERE id=$1',[s.id,p.data]); return send(res,{ageGroup:p.data});
}));
rosterRoutes.delete('/:aid/:sid', wrap(async (req,res) => { if (!await owned(req)) return fail(res,404,'Assignment not found'); const r = await getDb().query('DELETE FROM vedai_students WHERE id=$1 AND assignment_id=$2',[req.params.sid,req.params.aid]); return r.rowCount ? send(res,{}) : fail(res,404,'Student not found'); }));
const attempts = new Map<string, { count: number; until: number }>();
studentRoutes.post('/login', wrap(async (req,res) => {
 const ip = req.ip || ''; const now = Date.now(); const hit = attempts.get(ip); if (hit && hit.until > now && hit.count >= 20) return fail(res,429,'Too many attempts. Try again in 15 minutes.');
 attempts.set(ip,{count: hit && hit.until > now ? hit.count + 1 : 1,until: hit && hit.until > now ? hit.until : now + 900000});
 const p = z.object({studentId:z.string().trim().max(80),accessCode:z.string().max(100)}).safeParse(req.body); if (!p.success) return fail(res,400,'Enter your ID and access code');
 const { rows } = await getDb().query('SELECT * FROM vedai_students WHERE student_id=$1',[p.data.studentId]); const s = rows[0];
 if (!s || !verifyPassword(p.data.accessCode,s.code_hash)) return fail(res,401,'Wrong student ID or access code');
 res.cookie('vedai_student',signToken(`student:${s.id}:${s.session_version}`),cookieOptions); return send(res,{student:{studentId:s.student_id,name:s.name}});
}));
studentRoutes.post('/logout', (_req,res) => {res.clearCookie('vedai_student',{path:'/'});send(res,{});});
studentRoutes.get('/me', wrap(async (req,res) => {
 const s = await student(req); if (!s) return fail(res,401,'Please sign in'); const a = await Assignment.findById(s.assignment_id); if (!a) return fail(res,404,'Assignment not found');
 const qs = questions(a).map(({ id,number,text,marks,type,options }) => ({id,number,text,marks,type,options}));
 return send(res,{student:summary(s,a),assignment:{title:a.title,subject:a.subject,totalMarks:a.output?.totalMarks || a.totalMarks,dueDate:a.dueDate,questions:qs},submission:{submitted:!!s.submitted_at,submittedAt:s.submitted_at,late:summary(s,a).late,answers:s.answers,...(s.released ? {marks:s.marks,total:total(s.marks)} : {})}});
}));
studentRoutes.post('/consent', wrap(async (req,res) => { const s=await student(req); if (!s) return fail(res,401,'Please sign in'); if (typeof req.body.agree !== 'boolean') return fail(res,400,'Invalid consent'); await getDb().query('UPDATE vedai_students SET ai_consent=$2 WHERE id=$1',[s.id,req.body.agree]); return send(res,{aiConsent:req.body.agree}); }));
studentRoutes.post('/submit', wrap(async (req,res) => {
 const s=await student(req); if (!s) return fail(res,401,'Please sign in'); const a=await Assignment.findById(s.assignment_id); if (!a || a.status !== 'completed') return fail(res,409,'Paper is not available');
 const p=z.record(z.string().max(5000)).safeParse(req.body.answers); if (!p.success) return fail(res,400,'Answers must be text, up to 5,000 characters per question');
 const qs=questions(a); if (Object.keys(p.data).some(id=>!qs.some(q=>q.id===id))) return fail(res,400,'Unknown question');
 const r=await getDb().query('UPDATE vedai_students SET answers=$2::jsonb,submitted_at=now() WHERE id=$1 AND submitted_at IS NULL RETURNING submitted_at',[s.id,JSON.stringify(p.data)]);
 if (!r.rows[0]) return fail(res,409,'Answers already submitted');
 // Persist first, then enqueue durable grading so long papers never block submission.
 try {
   await getDb().query('UPDATE vedai_students SET grading_error=$2 WHERE id=$1', [s.id,'Jev grading queued. Refresh this review shortly.']);
   await getAssignmentQueue().add('grade-submission', { studentId: s.id }, { jobId: `grade-${s.id}`, removeOnComplete: true, removeOnFail: true });
 } catch {
   await getDb().query('UPDATE vedai_students SET grading_error=$2 WHERE id=$1', [s.id,'Submission saved. Grading queue unavailable; retry from teacher review.']);
 }
 return send(res,{submitted:true,late:new Date(r.rows[0].submitted_at)>new Date(a.dueDate)});
}));
for (const router of [rosterRoutes,studentRoutes]) router.use((err: any,_req: Request,res: Response,_next: NextFunction) => { console.error('Classroom request failed:',err?.name); fail(res,500,'Could not complete this request. Please try again.'); });
