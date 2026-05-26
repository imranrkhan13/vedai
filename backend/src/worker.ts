import { Worker, Job } from 'bullmq';

// Load .env only in dev
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

import { connectDB } from './services/db';
import { getRedis } from './services/redis';
import { Assignment } from './models/Assignment';
import { generateQuestionPaper } from './services/aiGenerator';
import { notifyClient } from './services/websocket';

async function processAssignmentJob(job: Job) {
  const { assignmentId, clientId } = job.data;
  console.log(`Processing job ${job.id} for assignment ${assignmentId}`);

  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) throw new Error(`Assignment ${assignmentId} not found`);

  assignment.status = 'processing';
  await assignment.save();

  if (clientId) {
    notifyClient(clientId, { type: 'job:progress', assignmentId, status: 'processing', message: 'Generating your question paper...', progress: 20 });
  }

  await job.updateProgress(30);

  if (clientId) {
    notifyClient(clientId, { type: 'job:progress', assignmentId, status: 'processing', message: 'Structuring questions...', progress: 55 });
  }

  const output = await generateQuestionPaper(assignment);
  await job.updateProgress(90);

  assignment.status = 'completed';
  assignment.output = output;
  await assignment.save();

  await job.updateProgress(100);

  if (clientId) {
    notifyClient(clientId, { type: 'job:completed', assignmentId, status: 'completed', message: 'Question paper generated!', progress: 100 });
  }

  return { assignmentId, status: 'completed' };
}

async function startWorker() {
  await connectDB();

  const worker = new Worker('assignment-generation', processAssignmentJob, {
    connection: getRedis(),
    concurrency: 3,
  });

  worker.on('completed', (job) => console.log(`✅ Job ${job.id} completed`));

  worker.on('failed', async (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
    if (job?.data?.assignmentId) {
      await Assignment.findByIdAndUpdate(job.data.assignmentId, { status: 'failed', error: err.message });
      if (job.data.clientId) {
        notifyClient(job.data.clientId, { type: 'job:failed', assignmentId: job.data.assignmentId, status: 'failed', message: 'Generation failed. Please try again.' });
      }
    }
  });

  console.log('🔄 Worker started and listening for jobs...');
}

startWorker().catch(console.error);
