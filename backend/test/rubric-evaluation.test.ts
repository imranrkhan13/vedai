import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gradeAnswers } from '../src/services/grading';
import { IQuestion } from '../src/models/Assignment';
(async()=>{
 const original=global.fetch,key=process.env.TYPESAFE_API_KEY;process.env.TYPESAFE_API_KEY='mock-only';let calls=0,n=0;
 const cases=[
 {id:'sound',text:'Describe how faster and larger vibrations change sound.',answer:'Faster vibrations give higher pitch. Larger vibrations give louder sound.',evidence:'Faster vibrations produce a higher pitch. Larger vibrations produce a louder sound.',points:['Links faster vibration to higher pitch; accept higher frequency or shriller tone.','Links larger vibration to greater loudness; accept larger amplitude or louder volume.'],partial:'Faster vibrations create higher pitch.',wrong:'Faster vibrations lower pitch. Larger vibrations make sound quieter.',alternative:'A quicker oscillation sounds shriller; greater amplitude increases volume.'},
 {id:'friction',text:'Define friction and compare its effect on rough and smooth surfaces.',answer:'Friction opposes motion between contacting surfaces. Rough surfaces usually cause more friction.',evidence:'Friction is a force that opposes motion between two surfaces in contact. Rough surfaces usually produce more friction than smooth surfaces.',points:['Friction opposes motion between surfaces in contact.','Rough surfaces usually produce more friction than smooth surfaces.'],partial:'Friction resists movement between touching surfaces.',wrong:'Friction helps motion. Smooth surfaces always produce more friction.',alternative:'Resistance to relative movement occurs at touching surfaces, and is usually greater when those surfaces are rough.'},
 {id:'grip',text:'Name a substance that reduces machine friction and a feature that improves grip.',answer:'Oil or grease reduces machine friction. Grooves on soles or tyre treads improve grip.',evidence:'Oil and grease reduce friction between moving machine parts. Grooves on shoe soles and tyre treads improve grip.',points:['Names oil or grease as a lubricant that reduces machine friction.','Names grooves on soles or tyre treads as a grip-improving feature.'],partial:'Grease can reduce friction in a machine.',wrong:'Rough sand lubricates machines. Smooth bald tyres improve grip.',alternative:'Lubricating with oil reduces resistance; the tread pattern in tyres gives better traction.'}
 ];
 const results=[];
 try{for(const c of cases){
 const q:IQuestion={id:c.id,text:c.text,type:'Short',difficulty:'medium',marks:2,answer:c.answer,evidence:c.evidence,markingPoints:c.points.map(text=>({text,marks:1}))};
 const samples=[{kind:'correct',answer:q.answer!,expected:2,checks:[.99,.99]},{kind:'partly correct',answer:c.partial,expected:1,checks:[.99,.01]},{kind:'wrong',answer:c.wrong,expected:0,checks:[.01,.01]},{kind:'blank',answer:' \n ',expected:0,checks:[]},{kind:'alternative wording',answer:c.alternative,expected:2,checks:[.99,.99]}];
 for(const sample of samples){const before=calls;global.fetch=(async(_url,opts)=>{calls++;const request=JSON.parse(String(opts?.body));assert.ok(request.questions.point_0.instructions.includes('valid alternative'));assert.equal(request.state.sourceExcerpt,q.evidence);return new Response(JSON.stringify({model:'jev-MOCK',answers:Object.fromEntries(sample.checks.map((value,i)=>[`point_${i}`,{type:'noul',noul:value}]))}));}) as typeof fetch;
 const draft:any=(await gradeAnswers([q],{[q.id]:sample.answer}))[q.id];assert.equal(draft.marks,sample.expected);n++;assert.equal(calls-before,sample.kind==='blank'?0:1);n++;assert.equal(draft.requiresReview,sample.kind!=='blank');n++;
 if(sample.kind==='blank'){assert.equal(draft.gradingMethod,'local-blank');assert.match(draft.explanationSource,/No AI provider/);n+=2;}
 results.push({question:q,...sample,checks:undefined,suggested:draft.marks,reason:draft.reason,provider:sample.kind==='blank'?'none':'mocked; not a live model evaluation'});
 }
 }
 const q:IQuestion={id:'failure',text:cases[0].text,type:'Short',difficulty:'medium',marks:2,answer:cases[0].answer,markingPoints:cases[0].points.map(text=>({text,marks:1}))};
 for(const failure of [async()=>new Response('{}',{status:429}),async()=>new Response('{bad'),async()=>{throw new Error('network failure')},async()=>new Response(JSON.stringify({model:'mock',answers:{}}))]){global.fetch=failure as typeof fetch;await assert.rejects(gradeAnswers([q],{failure:'A written answer'}));n++;}
 const report={review:'Developer/AI-authored synthetic expectations and mocked provider decisions. Not teacher approval or an independent accuracy measurement.',source:fs.readFileSync('test/fixtures/grade-8-source-656.txt','utf8'),results,remaining:'A real teacher should review question suitability, criteria, alternative wording and expected marks. No live paid calls made.'};
 fs.mkdirSync('../output/qa',{recursive:true});fs.writeFileSync('../output/qa/rubric-samples.json',JSON.stringify(report,null,2));console.log(`Rubric evaluation contract passed (${n} assertions; mocked only, ${calls} calls intercepted)`);
 }finally{global.fetch=original;if(key)process.env.TYPESAFE_API_KEY=key;else delete process.env.TYPESAFE_API_KEY;}
})().catch(e=>{console.error(e);process.exit(1)});
