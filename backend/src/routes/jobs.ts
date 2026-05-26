import { Router, Request, Response } from 'express';
import { getAssignmentQueue } from '../services/queue';

const router = Router();

router.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    const queue = getAssignmentQueue();
    const job = await queue.getJob(jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    const state = await job.getState();
    return res.json({
      success: true,
      data: { id: job.id, state, progress: job.progress, data: job.data, failedReason: job.failedReason },
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to get job' });
  }
});

export default router;
