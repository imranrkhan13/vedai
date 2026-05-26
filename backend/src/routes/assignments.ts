import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Assignment } from '../models/Assignment';
import { getAssignmentQueue } from '../services/queue';
import { getRedis } from '../services/redis';

const router = Router();

const CreateAssignmentSchema = z.object({
  title: z.string().min(1),
  subject: z.string().min(1),
  dueDate: z.string().min(1),
  questionTypes: z.array(z.string()).min(1),
  numberOfQuestions: z.number().int().min(1).max(100),
  totalMarks: z.number().min(1).max(500),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  additionalInstructions: z.string().optional(),
  fileContent: z.string().optional(),
  clientId: z.string().optional(),
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const assignments = await Assignment.find()
      .sort({ createdAt: -1 })
      .select('-output -fileContent')
      .limit(50);
    res.json({ success: true, data: assignments });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch assignments' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const redis = getRedis();
    const cached = await redis.get(`assignment:${req.params.id}`);
    if (cached) return res.json({ success: true, data: JSON.parse(cached), cached: true });

    const assignment = await Assignment.findById(req.params.id);
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
    const assignment = await Assignment.create({ ...data, dueDate: new Date(data.dueDate), status: 'pending' });

    const queue = getAssignmentQueue();
    const job = await queue.add('generate', { assignmentId: assignment._id.toString(), clientId: data.clientId });
    assignment.jobId = job.id?.toString();
    await assignment.save();

    return res.status(201).json({ success: true, data: { id: assignment._id, jobId: job.id, status: 'pending' } });
  } catch (err) {
    console.error('Create error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create' });
  }
});

router.post('/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, error: 'Not found' });

    assignment.status = 'pending';
    assignment.set('output', undefined);
    assignment.error = undefined;
    await assignment.save();

    const redis = getRedis();
    await redis.del(`assignment:${req.params.id}`);

    const queue = getAssignmentQueue();
    const job = await queue.add('generate', { assignmentId: assignment._id.toString(), clientId: req.body.clientId });
    assignment.jobId = job.id?.toString();
    await assignment.save();

    return res.json({ success: true, data: { jobId: job.id, status: 'pending' } });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to regenerate' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await Assignment.findByIdAndDelete(req.params.id);
    await getRedis().del(`assignment:${req.params.id}`);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to delete' });
  }
});

export default router;
