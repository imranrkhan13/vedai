import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Assignment } from '../models/Assignment';
import { getAssignmentQueue } from '../services/queue';
import { getRedis } from '../services/redis';
import { requireAuth } from '../services/auth';

// Demo-only client for TypeSafe Jev "Score" questions. Server-side only; the key never reaches the browser.

interface JevScoreResult {
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
  model: string;
}

function jevEnabled(): boolean {
  return process.env.JEV_ENABLED === 'true' && !!process.env.JEV_API_KEY && !!process.env.JEV_DEMO_USER_ID;
}

// Server-fixed SYNTHETIC answers (photosynthesis demo passage). No user-typed text is ever sent to Jev.
const JEV_FIXTURES: Record<string, string> = {
  full: 'SYNTHETIC TEST Chlorophyll in the chloroplasts of the leaf absorbs sunlight. Carbon dioxide enters through the stomata and water comes up from the roots. The plant turns carbon dioxide and water into glucose and releases oxygen. Extra glucose is stored as starch, and without sunlight the process slows and stops.',
  partial: 'SYNTHETIC TEST Chlorophyll absorbs sunlight and the plant uses carbon dioxide and water to make glucose. Oxygen is released.',
  weak: 'SYNTHETIC TEST Plants use sunlight and water to grow. They need light.',
};

const JEV_MAX_PER_PAPER = Number(process.env.JEV_MAX_PER_PAPER || 4);
const JEV_MAX_PER_DAY = Number(process.env.JEV_MAX_PER_DAY || 15);

// Hard app-wide daily cap (Redis counter). Returns false when the cap is reached.
async function takeDailySlot(): Promise<boolean> {
  const key = `jev:day:${new Date().toISOString().slice(0, 10)}`;
  const r = getRedis();
  const n = await r.incr(key);
  if (n === 1) await r.expire(key, 60 * 60 * 30);
  if (n > JEV_MAX_PER_DAY) { await r.decr(key); return false; }
  return true;
}

async function jevScore(state: Record<string, string>, instructions: string, criteria: string[]): Promise<JevScoreResult> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const resp = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.JEV_API_KEY}` },
      body: JSON.stringify({ state, model: 'jev-1.13.0', questions: { q: { type: 'score', instructions, criteria } } }),
      signal: ctl.signal,
    });
    if (!resp.ok) throw new Error(`jev ${resp.status}`);
    const j: any = await resp.json();
    const a = j?.answers?.q;
    if (!a || a.type !== 'score' || typeof a.score !== 'number' || !a.probabilities) throw new Error('jev bad shape');
    return { score: a.score, confidence: Number(a.confidence), probabilities: a.probabilities, model: String(j.model || 'jev-1.13.0') };
  } finally {
    clearTimeout(t);
  }
}

const router = Router();
router.use(requireAuth);

const CreateAssignmentSchema = z.object({
  title: z.string().min(1),
  subject: z.string().min(1),
  dueDate: z.string().min(1),
  questionTypes: z.array(z.string()).min(1),
  questionPlan: z.array(z.object({ type: z.string().min(1), qty: z.number().int().min(1).max(100), marks: z.number().int().min(1).max(100) })).min(1).max(12).optional(),
  numberOfQuestions: z.number().int().min(1).max(100),
  totalMarks: z.number().min(1).max(500),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  additionalInstructions: z.string().optional(),
  fileContent: z.string().optional(),
  clientId: z.string().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const assignments = await Assignment.list(req.userId!);
    res.json({ success: true, data: assignments });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch assignments' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    // Ownership check first: the cache is keyed by id only.
    const own = await Assignment.findById(req.params.id as string, req.userId!);
    if (!own) return res.status(404).json({ success: false, error: 'Not found' });
    const redis = getRedis();
    const cached = await redis.get(`assignment:${req.params.id}`);
    if (cached) return res.json({ success: true, data: JSON.parse(cached), cached: true });

    const assignment = await Assignment.findById(req.params.id as string);
    if (!assignment) return res.status(404).json({ success: false, error: 'Not found' });

    if (assignment.status === 'completed') {
      await redis.setex(`assignment:${req.params.id}`, 600, JSON.stringify(assignment));
    }
    return res.json({ success: true, data: assignment });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = CreateAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
    }
    const data = parsed.data;
    if (data.questionPlan) {
      const q = data.questionPlan.reduce((n, r) => n + r.qty, 0);
      const m = data.questionPlan.reduce((n, r) => n + r.qty * r.marks, 0);
      if (q !== data.numberOfQuestions || m !== data.totalMarks) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: [{ path: ['questionPlan'], message: `Plan adds up to ${q} questions / ${m} marks, request says ${data.numberOfQuestions} / ${data.totalMarks}` }] });
      }
      data.questionTypes = data.questionPlan.map((r) => r.type);
    }
    if (data.fileContent && data.fileContent.trim().length > 0 && data.fileContent.trim().length < data.numberOfQuestions * 40) {
      const fit = Math.max(1, Math.floor(data.fileContent.trim().length / 40));
      return res.status(400).json({ success: false, error: 'Source text is too short for ' + data.numberOfQuestions + ' questions. Add more notes or ask for about ' + fit + ' or fewer (rough guide: 40 characters of source per question).' });
    }
    const dueDate = new Date(data.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: [{ path: ['dueDate'], message: 'Invalid date' }] });
    }
    const assignment = await Assignment.create({ ...data, dueDate }, req.userId!);

    const queue = getAssignmentQueue();
    const job = await queue.add('generate', { assignmentId: assignment._id, clientId: data.clientId ? `${req.userId}:${data.clientId}` : undefined });
    await Assignment.setJobId(assignment._id, job.id?.toString());

    return res.status(201).json({ success: true, data: { id: assignment._id, _id: assignment._id, jobId: job.id, status: 'pending' } });
  } catch (err) {
    console.error('Create error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create' });
  }
});

router.post('/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findById(req.params.id as string, req.userId!);
    if (!assignment) return res.status(404).json({ success: false, error: 'Not found' });

    await Assignment.resetForRegenerate(assignment._id);

    const redis = getRedis();
    await redis.del(`assignment:${req.params.id}`);

    const queue = getAssignmentQueue();
    const job = await queue.add('generate', { assignmentId: assignment._id, clientId: req.body?.clientId ? `${req.userId}:${req.body.clientId}` : undefined });
    await Assignment.setJobId(assignment._id, job.id?.toString());

    return res.json({ success: true, data: { jobId: job.id, status: 'pending' } });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to regenerate' });
  }
});

const RubricEditSchema = z.object({
  questionId: z.string().min(1).max(100),
  levels: z.array(z.object({
    marks: z.number().int().min(0).max(500),
    descriptor: z.string().trim().min(1).max(500),
    example: z.string().trim().min(1).max(700),
  })).length(3),
});

router.patch('/:id/rubric', async (req: Request, res: Response) => {
  try {
    const parsed = RubricEditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Each of the 3 levels needs whole-number marks, a description and an example.' });
    const a = await Assignment.findById(req.params.id as string, req.userId!);
    if (!a || a.status !== 'completed' || !a.output) return res.status(404).json({ success: false, error: 'Not found' });
    const q = a.output.sections.flatMap((sec) => sec.questions).find((x) => x.id === parsed.data.questionId);
    if (!q) return res.status(404).json({ success: false, error: 'Question not found' });
    const lv = parsed.data.levels;
    if (lv.some((l) => l.marks > q.marks)) return res.status(400).json({ success: false, error: 'A level cannot give more than the question maximum of ' + q.marks + ' marks.' });
    if (!(lv[0].marks > lv[1].marks && lv[1].marks > lv[2].marks)) return res.status(400).json({ success: false, error: 'Levels must go from higher to lower marks.' });
    q.rubric = lv;
    q.rubricEdited = true;
    const ok = await Assignment.setOutputForOwner(a._id, req.userId!, a.output);
    if (!ok) return res.status(404).json({ success: false, error: 'Not found' });
    await getRedis().del(`assignment:${req.params.id}`);
    return res.json({ success: true, data: { questionId: q.id, rubric: q.rubric } });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to save' });
  }
});

const GradeSchema = z.object({ questionId: z.string().min(1).max(100), fixture: z.enum(['full', 'partial', 'weak']), overwrite: z.boolean().optional() });

// DEMO ONLY: grades a SYNTHETIC TEST answer against the saved 3-level rubric with Jev Score.
router.post('/:id/grade', async (req: Request, res: Response) => {
  try {
    if (!jevEnabled()) return res.status(503).json({ success: false, error: 'The grading demo is not switched on.' });
    const parsed = GradeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Pick one of the built-in synthetic demo answers.' });
    if (req.userId !== process.env.JEV_DEMO_USER_ID) return res.status(403).json({ success: false, error: 'The grading demo is limited to the approved demo account.' });
    const fixtureAnswer = JEV_FIXTURES[parsed.data.fixture];
    const a = await Assignment.findById(req.params.id as string, req.userId!);
    if (!a || a.status !== 'completed' || !a.output) return res.status(404).json({ success: false, error: 'Not found' });
    const q = a.output.sections.flatMap((sec) => sec.questions).find((x) => x.id === parsed.data.questionId);
    if (!q) return res.status(404).json({ success: false, error: 'Question not found' });
    if (!q.rubric || q.rubric.length !== 3) return res.status(400).json({ success: false, error: 'This question has no marking levels to grade against.' });
    if (q.grade && q.grade.edited && !parsed.data.overwrite) return res.status(409).json({ success: false, error: 'You already saved your own marks for this question. Grading again keeps them in history but replaces the draft. Confirm to continue.' });
    if ((a.output.gradeCalls || 0) >= JEV_MAX_PER_PAPER) return res.status(429).json({ success: false, error: 'Demo limit reached for this paper (' + JEV_MAX_PER_PAPER + ' gradings).' });
    if (!(await takeDailySlot())) return res.status(429).json({ success: false, error: 'The demo daily limit has been reached. Try again tomorrow.' });
    // ascending marks, the order Jev expects (low end to high end)
    const asc = [...q.rubric].sort((x, y) => x.marks - y.marks).map((l) => ({ marks: Math.min(l.marks, q.marks), descriptor: l.descriptor }));
    let r;
    try {
      r = await jevScore(
        { exam_question: q.text, student_answer: fixtureAnswer },
        'How well does `student_answer` answer `exam_question`? Judge it only against the levels.',
        asc.map((l) => l.descriptor),
      );
    } catch {
      a.output.gradeCalls = (a.output.gradeCalls || 0) + 1;
      await Assignment.setOutputForOwner(a._id, req.userId!, a.output);
      await getRedis().del(`assignment:${req.params.id}`);
      return res.status(502).json({ success: false, error: 'The grading service did not return a usable answer. Nothing was changed except your demo allowance.' });
    }
    let best = 0; let bp = -1;
    for (let i = 0; i < asc.length; i++) { const p = Number(r.probabilities[String(i)] ?? 0); if (p > bp) { bp = p; best = i; } }
    const hist = (q as any).gradeHistory || [];
    if (q.grade) { hist.push(q.grade); (q as any).gradeHistory = hist.slice(-5); }
    q.grade = {
      answer: fixtureAnswer, levelIndex: best, marks: asc[best].marks, probabilities: r.probabilities,
      confidence: r.confidence, score: r.score, model: r.model, rubricSnapshot: asc, gradedAt: new Date().toISOString(),
    };
    a.output.gradeCalls = (a.output.gradeCalls || 0) + 1;
    const ok = await Assignment.setOutputForOwner(a._id, req.userId!, a.output);
    if (!ok) return res.status(404).json({ success: false, error: 'Not found' });
    await getRedis().del(`assignment:${req.params.id}`);
    return res.json({ success: true, data: { questionId: q.id, grade: q.grade, gradeCalls: a.output.gradeCalls, maxPerPaper: JEV_MAX_PER_PAPER } });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to grade' });
  }
});

const GradeEditSchema = z.object({ questionId: z.string().min(1).max(100), marks: z.number().int().min(0).max(500), reason: z.string().trim().max(500).optional() });

router.patch('/:id/grade', async (req: Request, res: Response) => {
  try {
    const parsed = GradeEditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Marks must be a whole number.' });
    const a = await Assignment.findById(req.params.id as string, req.userId!);
    if (!a || a.status !== 'completed' || !a.output) return res.status(404).json({ success: false, error: 'Not found' });
    const q = a.output.sections.flatMap((sec) => sec.questions).find((x) => x.id === parsed.data.questionId);
    if (!q || !q.grade) return res.status(404).json({ success: false, error: 'Not found' });
    if (parsed.data.marks > q.marks) return res.status(400).json({ success: false, error: 'Marks cannot be more than the question maximum of ' + q.marks + '.' });
    q.grade.teacherMarks = parsed.data.marks;
    q.grade.reason = parsed.data.reason || '';
    q.grade.edited = true;
    const ok = await Assignment.setOutputForOwner(a._id, req.userId!, a.output);
    if (!ok) return res.status(404).json({ success: false, error: 'Not found' });
    await getRedis().del(`assignment:${req.params.id}`);
    return res.json({ success: true, data: { questionId: q.id, teacherMarks: q.grade.teacherMarks, reason: q.grade.reason } });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to save' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const removed = await Assignment.deleteById(req.params.id as string, req.userId!);
    if (!removed) return res.status(404).json({ success: false, error: 'Not found' });
    await getRedis().del(`assignment:${req.params.id}`);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to delete' });
  }
});

export default router;
