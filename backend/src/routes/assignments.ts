import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Assignment } from '../models/Assignment';
import { getAssignmentQueue } from '../services/queue';
import { getDb } from '../services/db';
import { requireAuth } from '../services/auth';

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
  fileContent: z.string().max(100000).optional(),
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
    const assignment = await Assignment.findById(req.params.id as string, req.userId!);
    if (!assignment) return res.status(404).json({ success: false, error: 'Not found' });
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
    const dueDate = new Date(data.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: [{ path: ['dueDate'], message: 'Invalid date' }] });
    }
    const assignment = await Assignment.create({ ...data, dueDate }, req.userId!);

    const queue = getAssignmentQueue();
    const job = await queue.add('generate', { assignmentId: assignment._id, clientId: data.clientId });
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

    const enrolled = await getDb().query('SELECT id FROM vedai_classroom_students WHERE assignment_id=$1 LIMIT 1', [assignment._id]);
    if (enrolled.rows.length) return res.status(409).json({ success: false, error: 'This paper has assigned students. Create a new paper to preserve their submissions.' });
    await Assignment.resetForRegenerate(assignment._id);


    const queue = getAssignmentQueue();
    const job = await queue.add('generate', { assignmentId: assignment._id, clientId: req.body.clientId });
    await Assignment.setJobId(assignment._id, job.id?.toString());

    return res.json({ success: true, data: { jobId: job.id, status: 'pending' } });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to regenerate' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const removed = await Assignment.deleteById(req.params.id as string, req.userId!);
    if (!removed) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to delete' });
  }
});

router.patch('/:id/rubric', async (req, res) => {
  const a = await Assignment.findById(String(req.params.id), req.userId!);
  if (!a?.output) return res.status(404).json({ success: false, error: 'Paper not found' });
  const p = z.object({ questionId: z.string(), levels: z.array(z.object({ marks: z.number().int().nonnegative(), descriptor: z.string().min(1).max(2000), example: z.string().max(5000) })).length(3) }).safeParse(req.body);
  const q = p.success && a.output.sections.flatMap(s => s.questions).find(q => q.id === p.data.questionId);
  if (!p.success || !q || p.data.levels.some(l => l.marks > q.marks)) return res.status(400).json({ success: false, error: 'Invalid marking guide' });
  Object.assign(q, { rubric: p.data.levels, rubricEdited: true });
  await Assignment.setCompleted(a._id, a.output);
  return res.json({ success: true });
});
export default router;
