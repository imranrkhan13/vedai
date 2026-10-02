import { Queue } from 'bullmq';
import { getRedis } from './redis';

let assignmentQueue: Queue | null = null;

export function getAssignmentQueue(): Queue {
  if (!assignmentQueue) {
    const connection = getRedis();
    assignmentQueue = new Queue('assignment-generation', {
      connection,
      defaultJobOptions: {
        attempts: Math.max(1, parseInt(process.env.QUEUE_ATTEMPTS || '3', 10) || 3),
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return assignmentQueue;
}
