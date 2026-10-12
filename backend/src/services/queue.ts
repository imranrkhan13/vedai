import crypto from 'node:crypto';
import { getDb } from './db';
export interface Job {
 id: string; name: string; data: Record<string, any>; progress: number;
 attemptsMade: number; opts: { attempts: number }; failedReason?: string; leaseToken?: string;
 updateProgress(progress: number): Promise<void>; getState(): Promise<string>;
}
function jobFrom(row: any): Job {
 return { id: row.id, name: row.name, data: row.data, progress: row.progress,
  attemptsMade: row.attempts_made, opts: { attempts: row.max_attempts }, failedReason: row.failed_reason, leaseToken: row.lease_token,
  async updateProgress(progress) {
   const r = await getDb().query("UPDATE vedai_jobs SET progress=$2 WHERE id=$1 AND lease_token=$3 AND state='active'", [row.id, progress, row.lease_token]);
   if (!r.rowCount) throw new Error('Job lease expired or reassigned');
  },
  async getState() { const r = await getDb().query('SELECT state FROM vedai_jobs WHERE id=$1', [row.id]); return r.rows[0]?.state || 'unknown'; }
 };
}
export function getAssignmentQueue() {
 return {
  async add(name: string, data: Record<string, any>, options: { jobId?: string; removeOnComplete?: boolean; removeOnFail?: boolean } = {}) {
   const id = options.jobId || crypto.randomUUID();
   const attempts = Math.max(1, parseInt(process.env.QUEUE_ATTEMPTS || '3', 10) || 3);
   const r = await getDb().query(`INSERT INTO vedai_jobs (id,name,data,max_attempts) VALUES ($1,$2,$3::jsonb,$4)
    ON CONFLICT (id) DO UPDATE SET state='waiting',attempts_made=0,progress=0,failed_reason=NULL,available_at=now(),lease_token=NULL,lease_until=NULL,data=EXCLUDED.data
    WHERE vedai_jobs.state IN ('completed','failed') RETURNING *`, [id, name, JSON.stringify(data), attempts]);
   if (r.rows[0]) return jobFrom(r.rows[0]);
   return (await this.getJob(id))!;
  },
  async getJob(id: string) { const r = await getDb().query('SELECT * FROM vedai_jobs WHERE id=$1', [id]); return r.rows[0] ? jobFrom(r.rows[0]) : null; }
 };
}
// One atomic claim; concurrent workers skip jobs already locked by another worker.
export async function claimJob(): Promise<Job | null> {
 const r = await getDb().query(`WITH candidate AS (
  SELECT id FROM vedai_jobs WHERE (state='waiting' AND available_at<=now()) OR (state='active' AND lease_until<now())
  ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1
 ) UPDATE vedai_jobs j SET attempts_made=attempts_made+CASE WHEN j.state='active' THEN 1 ELSE 0 END,
 state='active',lease_token=$1,lease_until=now()+interval '10 minutes'
 FROM candidate c WHERE j.id=c.id RETURNING j.*`, [crypto.randomUUID()]);
 return r.rows[0] ? jobFrom(r.rows[0]) : null;
}
export async function renewLease(job: Job) {
 const r = await getDb().query("UPDATE vedai_jobs SET lease_until=now()+interval '10 minutes' WHERE id=$1 AND lease_token=$2 AND state='active'", [job.id, job.leaseToken]);
 return !!r.rowCount;
}
export async function finishJob(job: Job, error?: Error) {
 if (!error) { const r = await getDb().query("UPDATE vedai_jobs SET state='completed',progress=100,lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2", [job.id,job.leaseToken]); return !!r.rowCount; }
 job.attemptsMade++;
 const retry = job.attemptsMade < job.opts.attempts;
 const r = await getDb().query(`UPDATE vedai_jobs SET state=$3,attempts_made=$4,failed_reason=$5,lease_token=NULL,lease_until=NULL,
  available_at=now()+($6 * interval '1 second') WHERE id=$1 AND lease_token=$2`, [job.id,job.leaseToken,retry?'waiting':'failed',job.attemptsMade,error.message,Math.min(60,2 ** job.attemptsMade)]);
 return !!r.rowCount;
}
