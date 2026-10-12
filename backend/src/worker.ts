import { Worker, Job } from 'bullmq';

// Load .env only in dev
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}

import { processGradingJob } from './services/grading';
import { connectDB } from './services/db';
import { getRedis } from './services/redis';
import { Assignment } from './models/Assignment';
import { generateQuestionPaper } from './services/aiGenerator';
import { notifyClient } from './services/websocket';

export async function processAssignmentJob(job: Job) {
  if (job.name === 'grade-submission') { await processGradingJob(job.data.studentId); return { status: 'graded' }; }
  const { assignmentId, clientId } = job.data;
  console.log(`Processing job ${job.id} for assignment ${assignmentId}`);

  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) throw new Error(`Assignment ${assignmentId} not found`);

  await Assignment.setProcessing(assignmentId);

  if (clientId) {
    notifyClient(clientId, { type: 'job:progress', assignmentId, status: 'processing', message: 'Generating your question paper...', progress: 20 });
  }

  await job.updateProgress(30);

  if (clientId) {
    notifyClient(clientId, { type: 'job:progress', assignmentId, status: 'processing', message: 'Structuring questions...', progress: 55 });
  }

  const output = await generateQuestionPaper(assignment);
  await job.updateProgress(90);

  await Assignment.setCompleted(assignmentId, output);

  await job.updateProgress(100);

  if (clientId) {
    notifyClient(clientId, { type: 'job:completed', assignmentId, status: 'completed', message: 'Question paper generated!', progress: 100 });
  }

  return { assignmentId, status: 'completed' };
}

// Opt-in only: the web process runs the queue worker when WORKER_IN_WEB=true (default off).
export function shouldRunWorkerInWeb(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.WORKER_IN_WEB || '').toLowerCase() === 'true';
}

export async function handleAssignmentFailure(job: Job | undefined, err: Error) {
  if (!job?.data?.assignmentId || job.name === 'grade-submission') return;
  const { assignmentId, clientId } = job.data;
  const retrying = job.attemptsMade < (job.opts.attempts || 1) && err.name !== 'UnrecoverableError';
  if (retrying) {
    await Assignment.setProcessing(assignmentId);
    if (clientId) notifyClient(clientId, { type: 'job:progress', assignmentId, status: 'processing', message: 'Checking the paper and retrying generation...', progress: 20 });
    return;
  }
  await Assignment.setFailed(assignmentId, err.message);
  if (clientId) notifyClient(clientId, { type: 'job:failed', assignmentId, status: 'failed', message: 'Generation failed. Please try again.' });
}

export async function startWorker(opts: { connect?: boolean } = {}) {
  if (opts.connect !== false) await connectDB();

  const worker = new Worker('assignment-generation', processAssignmentJob, {
    connection: getRedis(),
    concurrency: Math.max(1, parseInt(process.env.WORKER_CONCURRENCY || '1', 10) || 1),
  });

  worker.on('completed', (job) => console.log(`✅ Job ${job.id} completed`));

  worker.on('failed', async (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
    await handleAssignmentFailure(job, err);
  });

  console.log('🔄 Worker started and listening for jobs...');
}

if (require.main === module) {
  startWorker().catch(console.error);
}
