import assert from 'node:assert/strict';
import { gradeAnswers } from '../src/services/grading';
import { IQuestion } from '../src/models/Assignment';
(async () => {
 const q: IQuestion = { id:'q',text:'Explain',answer:'A and B',marks:5,type:'Short',difficulty:'easy',markingPoints:[{text:'A',marks:2},{text:'B',marks:3}] };
 const original = global.fetch; const saved = process.env.TYPESAFE_API_KEY;
 try {
 delete process.env.TYPESAFE_API_KEY; await assert.rejects(gradeAnswers([q],{q:'A'}),/not configured/);
 process.env.TYPESAFE_API_KEY='test-key';
 global.fetch=(async (_url,options)=>{const body=JSON.parse(String(options?.body));assert.equal(body.model,'jev-latest');assert.equal(body.state.studentAnswer,'A');assert.equal(body.questions.point_1.type,'noul');return new Response(JSON.stringify({model:'jev-test',answers:{point_0:{type:'noul',noul:0.9},point_1:{type:'noul',noul:0.5}}}));}) as typeof fetch;
 const g:any = await gradeAnswers([q],{q:'A'});assert.equal(g.q.marks,2);assert.deepEqual(g.q.uncertain,['B']);assert.match(g.q.reason,/Withheld 3 marks/);assert.match(g.q.explanationSource,/App summary/);
 global.fetch=(async ()=>new Response(JSON.stringify({model:'jev-test',answers:{point_0:{type:'noul',noul:2}}}))) as typeof fetch;await assert.rejects(gradeAnswers([q],{q:'A'}));
 global.fetch=(async ()=>new Response(JSON.stringify({model:'jev-test',answers:{point_0:{type:'noul',noul:0.9}}}))) as typeof fetch;await assert.rejects(gradeAnswers([q],{q:'A'}),/incomplete/);
 global.fetch=(async ()=>new Response('{}',{status:429})) as typeof fetch;await assert.rejects(gradeAnswers([q],{q:'A'}),/unavailable/);
 await assert.rejects(gradeAnswers([{...q,markingPoints:[{text:'A',marks:6}]}],{q:'A'}),/maximum/);
 console.log('grading tests passed (12 assertions, simulated Jev responses)');
 } finally {global.fetch=original;if(saved)process.env.TYPESAFE_API_KEY=saved;else delete process.env.TYPESAFE_API_KEY;}
})().catch(e=>{console.error(e);process.exit(1);});
