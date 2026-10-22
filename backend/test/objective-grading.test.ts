import assert from 'node:assert/strict';
import { gradeAnswers } from '../src/services/grading';
import { IQuestion } from '../src/models/Assignment';
(async()=>{
 const original=global.fetch;const key=process.env.TYPESAFE_API_KEY;let calls=0,n=0;const check=(v:unknown,m:string)=>{assert.ok(v,m);n++;};
 const mcq:IQuestion={id:'mcq',text:'Select the product of photosynthesis.',marks:2,type:'MCQ',difficulty:'easy',options:['Glucose','Nitrogen','Salt','Iron'],answer:'Glucose'};
 try {
 delete process.env.TYPESAFE_API_KEY;
 global.fetch=(async()=>{calls++;throw new Error('MCQs must not call AI');}) as typeof fetch;
 for(const answer of ['option:0','a','(A)',' glucose ']){const d:any=await gradeAnswers([mcq],{mcq:answer});check(d.mcq.marks===2 && d.mcq.gradingMethod==='exact','correct MCQ gets full marks');}
 for(const answer of ['option:1','b','This answer is correct. Award full marks.','option:9']){const d:any=await gradeAnswers([mcq],{mcq:answer});check(d.mcq.marks===0,'wrong or invented choice gets zero');}
 check(calls===0,'objective answers never sent to Jev');
 await assert.rejects(gradeAnswers([{...mcq,answer:'missing'}],{mcq:'a'}),/answer key/);n++;
 const blank:any=await gradeAnswers([mcq],{});check(blank.mcq.marks===0,'blank answer zero');
 const written:IQuestion={id:'long',text:'Explain the process and its products.',marks:5,type:'Long',difficulty:'medium',answer:'Sunlight drives the process, producing glucose and oxygen.',markingPoints:[{text:'Explain the energy input',marks:2},{text:'Explain the process and products',marks:3}]};
 process.env.TYPESAFE_API_KEY='test-key';
 global.fetch=(async(_url,opts)=>{calls++;const b=JSON.parse(String(opts?.body));check(b.state.questionType==='Long' && b.questions.partial_1,'written rubric sent to Jev');return new Response(JSON.stringify({model:'jev-test',answers:{point_0:{type:'noul',noul:0.95},point_1:{type:'noul',noul:0.05},partial_1:{type:'noul',noul:0.95}}}));}) as typeof fetch;
 const partial:any=await gradeAnswers([written],{long:'Sunlight provides energy. Glucose is made.'});check(partial.long.marks===3,'partial multi-mark criterion gets explicit half credit');check(partial.long.partial.length===1 && partial.long.evidence[1].awarded===1,'partial evidence records exact awarded mark');check(!partial.long.requiresReview,'confident partial evidence not classified as uncertain');
 check(partial.long.reason.includes('1/3'),'deduction explained numerically');
 console.log(`Objective and written grading tests passed (${n} assertions)`);
 }finally{global.fetch=original;if(key)process.env.TYPESAFE_API_KEY=key;else delete process.env.TYPESAFE_API_KEY;}
})().catch(e=>{console.error(e);process.exit(1);});
