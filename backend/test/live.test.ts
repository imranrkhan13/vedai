import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.LIVE_API_URL || 'http://127.0.0.1:4000/api';
const tag = Date.now().toString();
const email = `live-${tag}@example.test`, password = 'Synthetic-Classroom-Test-2026!';
let checks = 0;
const check = (v: unknown, message: string) => { assert.ok(v,message); checks++; };
async function api(path: string, method = 'GET', body?: unknown, cookie = '') {
 const r = await fetch(base+path,{method,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json','X-Requested-With':'quillix',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,body:await r.json() as any,cookie:r.headers.get('set-cookie')?.split(';')[0] || ''};
}
async function poll<T>(fn:()=>Promise<T>, ready:(r:T)=>boolean, label:string) {
 const started=Date.now();let attempt=0;
 while(Date.now()-started<300000){const r=await fn();if(ready(r))return r;if(++attempt%10===0)console.log(`${label}: waiting ${Math.round((Date.now()-started)/1000)}s`);await new Promise(r=>setTimeout(r,2000));}
 throw new Error(`${label} timed out`);
}
(async()=>{
 const teacher=await api('/auth/register','POST',{email,password});check(teacher.status===201,'teacher registration');const cookie=teacher.cookie;
 check((await api('/auth/me','GET',undefined,cookie)).body.data.email===email,'cookie session');
 const syllabus = `FULL SYNTHETIC SCIENCE SYLLABUS\nChapter 1: Plants and photosynthesis. Plants use sunlight, carbon dioxide and water to produce glucose and oxygen. Chlorophyll absorbs light energy. Photosynthesis occurs in chloroplasts.\nChapter 2: Forces. Newton's second law states force equals mass times acceleration. Force is measured in newtons, mass in kilograms and acceleration in metres per second squared.\n` + 'Classroom activities: observe leaves, compare forces with different masses, and discuss how evidence supports a scientific explanation.\n'.repeat(20) + `\nFINAL CHAPTER: Electric circuits. A closed circuit is required for current to flow. A battery provides potential difference, wires conduct electricity, a switch opens or closes the circuit, and a lamp converts electrical energy to light and heat. An open circuit has a break and prevents current flow.\n`;
 const created=await api('/assignments','POST',{title:'Live syllabus workflow test',subject:'Science',dueDate:'2026-12-01',questionTypes:['MCQ','Long','Numerical'],questionPlan:[{type:'MCQ',qty:1,marks:2},{type:'Long',qty:1,marks:8},{type:'Numerical',qty:1,marks:5}],numberOfQuestions:3,totalMarks:15,difficulty:'mixed',fileContent:syllabus,additionalInstructions:'Use only this syllabus. Generate one 2-mark MCQ on photosynthesis with four options, one 8-mark Long question on closed electric circuits from the final chapter, and one 5-mark Numerical question calculating force with Newton second law. Every question needs distinct weighted marking points adding to its exact marks. Provide a model answer covering all points.'},cookie);
 check(created.status===201,`live assignment creation (${created.status}): ${created.body.error || 'unexpected response'}`);const aid=created.body.data.id;console.log('Live generation queued:',aid);
 const paper=await poll(()=>api(`/assignments/${aid}`,'GET',undefined,cookie),r=>['completed','failed'].includes(r.body.data?.status),'Generation');
 check(paper.body.data.status==='completed',`live generation failed: ${paper.body.data.error || ''}`);
 const assignment=paper.body.data;check(assignment.fileContent===syllabus,'entire syllabus preserved');check(!assignment.output.schoolName?.includes('SAMPLE'),'real AI output, not mock');
 const qs=assignment.output.sections.flatMap((s:any)=>s.questions);check(qs.length===3 && qs.reduce((n:number,q:any)=>n+q.marks,0)===15,'question and mark totals');
 check(qs.some((q:any)=>/circuit|electric/i.test(q.text)),'final syllabus chapter covered');check(qs.every((q:any)=>q.answer && (q.options?.length || q.markingPoints?.length)),'answer keys and marking points generated');
 const other=await api('/auth/register','POST',{email:`other-${tag}@example.test`,password});check((await api(`/assignments/${aid}`,'GET',undefined,other.cookie)).status===404,'teacher data isolation');
 const result:any={teacherEmail:email,assignmentId:aid,syllabusCharacters:syllabus.length,questions:qs.map((q:any)=>({id:q.id,text:q.text,maximum:q.marks,points:q.markingPoints})),students:[]};
 for(const kind of ['complete','partial','incorrect']){
  const id=`LIVE-${tag}-${kind}`;const added=await api(`/roster/${aid}`,'POST',{studentId:id,name:`Synthetic ${kind}`},cookie);check(added.status===200,'student assigned');const sid=added.body.data.id;
  check((await api(`/assignments/${aid}/regenerate`,'POST',{},cookie)).status===409,'assigned paper cannot regenerate');
  const login=await api('/student/login','POST',{studentId:id,accessCode:added.body.data.accessCode});check(login.status===200,'student login');const sc=login.cookie;
  const me=await api('/student/me','GET',undefined,sc);check(me.body.data.assignment.questions.every((q:any)=>!q.answer && !q.markingPoints),'student cannot see answers');
  const answers=Object.fromEntries(qs.map((q:any)=>[q.id,q.options?.length ? `option:${kind==='complete' ? q.options.indexOf(q.answer) : (q.options.indexOf(q.answer)+1)%q.options.length}` : kind==='complete'?q.answer:kind==='partial'?q.markingPoints[0].text:'The moon is made of cheese.']));
  const submit=await api('/student/submit','POST',{answers},sc);check(submit.status===200,'student submission with real queue');
  check((await api('/student/submit','POST',{answers},sc)).status===409,'duplicate submission rejected');
  const review=await poll(()=>api(`/roster/${aid}/${sid}`,'GET',undefined,cookie),r=>Object.keys(r.body.data?.aiDrafts||{}).length===3,'Jev grading');
  const drafts=review.body.data.aiDrafts;check(qs.every((q:any)=>Number.isInteger(drafts[q.id].marks)&&drafts[q.id].marks>=0&&drafts[q.id].marks<=q.marks&&drafts[q.id].reason),'numeric marks and reasons');
  check(qs.every((q:any)=>q.options?.length ? drafts[q.id].gradingMethod==='exact' && drafts[q.id].marks===(kind==='complete'?q.marks:0) : drafts[q.id].model.startsWith('jev')),'MCQs exact; written answers use real Jev');
  check(!(await api('/student/me','GET',undefined,sc)).body.data.submission.marks,'grades hidden before release');
  check((await api(`/roster/${aid}/${sid}/marks`,'PATCH',{questionId:qs[0].id,marks:99,reason:'invalid'},cookie)).status===400,'invalid marks rejected');
  check((await api(`/roster/${aid}/${sid}/release`,'POST',{released:true},cookie)).status===409,'incomplete marking cannot release');
  for(const q of qs){const dr=drafts[q.id];check((await api(`/roster/${aid}/${sid}/marks`,'PATCH',{questionId:q.id,marks:dr.marks,reason:dr.reason},cookie)).status===200,'teacher saves reviewed marks');}
  check((await api(`/roster/${aid}/${sid}/release`,'POST',{released:true},cookie)).status===200,'teacher releases results');
  const visible=await api('/student/me','GET',undefined,sc);const total=qs.reduce((n:number,q:any)=>n+drafts[q.id].marks,0);check(visible.body.data.submission.total===total,'student sees exact released total');
  check(visible.body.data.submission.marks[qs[0].id].reason===drafts[qs[0].id].reason,'student receives teacher-approved reasoning');
  result.students.push({kind,id,total,maximum:15,scores:qs.map((q:any)=>({questionId:q.id,...drafts[q.id]}))});
  console.log(`${kind}: ${total}/15; grading: ${qs.map((q:any)=>drafts[q.id].model).join(', ')}`);
 }
 check(result.students[0].total>result.students[2].total,'complete answers outperform incorrect');check(result.students[1].total>result.students[2].total&&result.students[1].total<result.students[0].total,'partial credit differs from complete and incorrect');
 result.assertionsPassed=checks;result.testedAt=new Date().toISOString();fs.writeFileSync('test/live-result.json',JSON.stringify(result,null,2));
 console.log(`LIVE WORKFLOW PASSED: ${checks} assertions. Evidence: test/live-result.json. Teacher: ${email}`);
})().catch(e=>{console.error('LIVE TEST FAILED:',e.message);process.exit(1);});
