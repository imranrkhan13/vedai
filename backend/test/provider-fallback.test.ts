import assert from 'node:assert/strict';
import { generateQuestionPaper } from '../src/services/aiGenerator';
(async()=>{
 const saved={...process.env};const original=global.fetch;const calls:string[]=[];let scenario='key';
 process.env.GROQ_API_KEY='primary-test';delete process.env.GROK_API_KEY;process.env.GROQ_API_KEY_FALLBACK='secondary-test';process.env.GEMINI_API_KEY='gemini-test';process.env.AI_PROVIDER_ALLOWLIST='groq,gemini';delete process.env.ALLOW_MOCK_OUTPUT;
 const paper=JSON.stringify({sections:[{title:'A',questions:[{text:'Name the pigment that absorbs light.',marks:2,type:'Short',answer:'Chlorophyll',evidence:'Chlorophyll absorbs light energy.',markingPoints:[{text:'Chlorophyll',marks:2}]}]}]});
 const assignment:any={title:'Science',subject:'Science',numberOfQuestions:1,totalMarks:2,questionTypes:['Short'],difficulty:'easy',fileContent:'Grade 8 science notes. Chlorophyll absorbs light energy.'};
 global.fetch=(async(url:any,opts:any)=>{const groq=String(url).includes('groq.com');const key=opts.headers.Authorization||'gemini';calls.push(key);assert.ok(opts.signal,'provider request bounded by timeout');
  if(scenario==='all')return new Response('{}',{status:429});
  if(groq && key==='Bearer primary-test')return new Response('{}',{status:401});
  let content=scenario==='invalid'&&groq?'not valid JSON':paper;
  if(scenario==='grade'&&groq)content=JSON.stringify({...JSON.parse(paper),grade:'Class 10'});
  if(scenario==='quote'&&groq)content=paper.replace('Chlorophyll absorbs light energy.','This sentence is not in the source.');
  return new Response(JSON.stringify(groq?{choices:[{message:{content}}]}:{candidates:[{content:{parts:[{text:content}]}}]}));}) as typeof fetch;
 try{
  let n=0;const check=(v:unknown,m:string)=>{assert.ok(v,m);n++;};
  const result=await generateQuestionPaper(assignment);check(result.totalMarks===2,'secondary key generates paper');check(calls.join('|')==='Bearer primary-test|Bearer secondary-test','primary first; backup only on failure');
  calls.length=0;scenario='invalid';check((await generateQuestionPaper(assignment)).totalMarks===2,'invalid Groq JSON falls back to valid Gemini paper');check(calls.includes('gemini'),'validation failure advances provider');
  calls.length=0;scenario='grade';check((await generateQuestionPaper(assignment)).grade==='Grade 8','wrong generated grade rejected before next provider succeeds');check(calls.includes('gemini'),'grade mismatch triggers fallback');
  calls.length=0;scenario='quote';check((await generateQuestionPaper(assignment)).totalMarks===2 && calls.includes('gemini'),'unverifiable source excerpt rejected');
  scenario='all';await assert.rejects(generateQuestionPaper(assignment),/Groq: Groq 429; Gemini: Gemini 429/);n++;
  check(!calls.some(x=>x.includes('openrouter')),'provider allowlist respected');
  console.log(`Provider fallback tests passed (${n} assertions)`);
 }finally{global.fetch=original;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
})().catch(e=>{console.error(e);process.exit(1);});
