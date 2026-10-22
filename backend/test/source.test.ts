import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readTextSource, sourceProblem as browserProblem } from '../../frontend/lib/sourceText';
import { sourceProblem, sourceGrade } from '../src/services/sourceText';
import { generateQuestionPaper } from '../src/services/aiGenerator';
(async()=>{
 let n=0;const check=(v:unknown,m:string)=>{assert.ok(v,m);n++;};
 const fixture=fs.readFileSync('test/fixtures/grade-8-source-656.txt','utf8');
 check(fixture.length===656,'regression fixture has exactly 656 readable characters');
 const decode=async(buffer:Buffer)=>readTextSource({arrayBuffer:async()=>Uint8Array.from(buffer).buffer});
 check(await decode(Buffer.from(fixture))===fixture,'UTF-8 TXT reads all 656 characters');
 check(await decode(Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(fixture)]))===fixture,'UTF-8 BOM supported');
 check(await decode(Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(fixture,'utf16le')]))===fixture,'UTF-16 LE BOM supported');
 check(await decode(Buffer.concat([Buffer.from([0xfe,0xff]),Buffer.from(fixture,'utf16le').swap16()]))===fixture,'UTF-16 BE BOM supported');
 await assert.rejects(decode(Buffer.from([0xc3,0x28])),/UTF-8/);n++;
 await assert.rejects(readTextSource({arrayBuffer:async()=>{throw new Error('Read failed');}}),/Read failed/);n++;
 for(const value of [undefined,'',' \n\t','\u0000\uFEFF','!!!---!!!',fixture,'a'.repeat(100001)])check(browserProblem(value)===sourceProblem(value),'browser/server source validation agree');
 check(sourceGrade(fixture)===8 && sourceGrade('Class VIII biology')===8 && sourceGrade('Class 10 science')===10,'explicit grades detected');
 let fetched=false;const original=global.fetch;
 global.fetch=(async()=>{fetched=true;throw new Error('Must not call provider');}) as typeof fetch;
 try{await assert.rejects(generateQuestionPaper({fileContent:'  '} as any),/readable source/);n++;check(!fetched,'empty source never reaches provider');}finally{global.fetch=original;}
 console.log(`Source extraction and guard tests passed (${n} assertions)`);
})().catch(e=>{console.error(e);process.exit(1);});
