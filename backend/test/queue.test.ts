import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { SCHEMA_SQL, setDb } from '../src/services/db';
import { getAssignmentQueue, claimJob, finishJob, renewLease } from '../src/services/queue';
(async()=>{
 const pg=new PGlite(); await pg.exec(SCHEMA_SQL);
 setDb({query:async(text,params)=>{const r=await pg.query(text,params as any[]);return {rows:r.rows as any[],rowCount:r.affectedRows??r.rows.length};}});
 let n=0;const check=(v:unknown,m:string)=>{assert.ok(v,m);n++;};const queue=getAssignmentQueue();
 const j=await queue.add('grade-submission',{studentId:'s'},{jobId:'grade-s'});
 await queue.add('grade-submission',{studentId:'s'},{jobId:'grade-s'});
 check((await pg.query('SELECT * FROM vedai_jobs')).rows.length===1,'pending jobs deduplicated');
 const claimed=await claimJob();check(claimed?.id===j.id && await claimed.getState()==='active','persisted job claimed');
 check(await claimJob()===null,'active job cannot be claimed twice');
 check(await renewLease(claimed!),'heartbeat keeps lease');
 await finishJob(claimed!,new Error('provider temporary failure'));
 check(await claimed!.getState()==='waiting','failure scheduled for retry');
 check(await claimJob()===null,'retry delay respected');
 await pg.exec("UPDATE vedai_jobs SET available_at=now()-interval '1 second'");
 const retry=await claimJob();check(retry?.attemptsMade===1,'attempt count persisted');
 await pg.exec("UPDATE vedai_jobs SET lease_until=now()-interval '1 second'");
 const recovered=await claimJob();check(recovered?.leaseToken!==retry?.leaseToken,'crashed worker lease reclaimed');
 await finishJob(retry!);check(await recovered!.getState()==='active','stale worker cannot complete reclaimed job');
 await recovered!.updateProgress(70);check((await queue.getJob(j.id))?.progress===70,'progress persisted');
 await finishJob(recovered!);check(await recovered!.getState()==='completed','completion persisted');
 await queue.add('grade-submission',{studentId:'s'},{jobId:'grade-s'});check(await recovered!.getState()==='waiting','explicit regrading restarts terminal job');
 for(let attempt=0;attempt<3;attempt++){await pg.exec("UPDATE vedai_jobs SET available_at=now()-interval '1 second'");const x=await claimJob();await finishJob(x!,new Error('always fails'));}
 check(await recovered!.getState()==='failed','exhausted retries terminal');
 await pg.close(); console.log(`Postgres queue tests passed (${n} assertions)`);
})().catch(e=>{console.error(e);process.exit(1);});
