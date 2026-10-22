import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildPaperPdf } from '../../frontend/lib/paperPdf';
const base=require('node:path').resolve(__dirname,'../..')+'/';
const questions=[
{text:'Which surfaces usually produce more friction?',options:['Rough surfaces','Smooth surfaces','Oiled surfaces','Polished surfaces'],answer:'Rough surfaces',marks:1},
{text:'What produces sound?',options:['Vibrating objects','Only light','A vacuum','Stationary objects'],answer:'Vibrating objects',marks:1},
{text:'Which statement describes a higher pitch?',options:['Faster vibrations','Larger vibrations','No vibrations','Less friction'],answer:'Faster vibrations',marks:1},
{text:'Where can sound not travel?',options:['A vacuum','Air','Water','Solids'],answer:'A vacuum',marks:1},
{text:'State the meaning of friction and compare friction on rough and smooth surfaces.',answer:'Friction opposes motion between contacting surfaces. Rough surfaces usually produce more friction.',marks:2,markingPoints:[{text:'Friction opposes motion between surfaces in contact.',marks:1},{text:'Rough surfaces usually produce more friction than smooth surfaces.',marks:1}]},
{text:'State how faster vibrations and larger vibrations affect sound.',answer:'Faster vibrations produce higher pitch. Larger vibrations produce louder sound.',marks:2,markingPoints:[{text:'Faster vibrations produce higher pitch.',marks:1},{text:'Larger vibrations produce louder sound.',marks:1}]},
{text:'Name a substance that reduces machine friction and a feature that improves grip.',answer:'Oil or grease reduces machine friction. Grooves on soles or tyre treads improve grip.',marks:2,markingPoints:[{text:'Oil or grease reduces machine friction.',marks:1},{text:'Grooves improve grip.',marks:1}]}
].map((q,i)=>({...q,id:'q'+i,type:q.options?'MCQ':'Short',difficulty:'medium' as const,evidence:['Rough surfaces usually produce more friction than smooth surfaces.','Sound is produced by vibrating objects.','Faster vibrations produce a higher pitch.','It cannot travel through a vacuum.','Friction is a force that opposes motion between two surfaces in contact. Rough surfaces usually produce more friction than smooth surfaces.','Faster vibrations produce a higher pitch. Larger vibrations produce a louder sound.','Oil and grease reduce friction between moving machine parts. Grooves on shoe soles and tyre treads improve grip.'][i]}));
const paper={title:'Grade 8 Science - seven-question QA',output:{subject:'Science',grade:'Grade 8',totalMarks:10,duration:'25 minutes',generatedAt:new Date().toISOString(),sections:[{title:'Section A',instruction:'Each question carries N marks.',questions:questions.slice(0,4),totalMarks:4},{title:'Section B',instruction:'Each question carries N marks.',questions:questions.slice(4),totalMarks:6}]}};
const fonts={regular:fs.readFileSync(base+'frontend/public/fonts/DejaVuSans.ttf').toString('base64'),bold:fs.readFileSync(base+'frontend/public/fonts/DejaVuSans-Bold.ttf').toString('base64')};
fs.mkdirSync(base+'output/pdf',{recursive:true});
for(const teacher of [false,true]){const pdf=buildPaperPdf(paper,teacher,fonts);const name=teacher?'teacher-guide':'student-paper';fs.writeFileSync(base+'output/pdf/'+name+'.pdf',Buffer.from(pdf.output('arraybuffer')));console.log(name,pdf.getNumberOfPages(),'pages');}
fs.mkdirSync(base+'output/qa',{recursive:true});fs.writeFileSync(base+'output/qa/paper-fixture.json',JSON.stringify(paper,null,2));
// Exercise long blocks across pages, not just the normal seven-question fixture.
const stress=structuredClone(paper);stress.output.sections[0].questions[0].text='Long question containing superscripts and Greek: m², α, β. '+('Explain a source-supported idea and show your reasoning. '.repeat(100));
const pdf=buildPaperPdf(stress,true,fonts);fs.writeFileSync(base+'output/pdf/long-layout-stress.pdf',Buffer.from(pdf.output('arraybuffer')));console.log('stress',pdf.getNumberOfPages(),'pages');

assert.throws(()=>buildPaperPdf({...paper,title:'Question {{insert title}}'},false,fonts),/Unresolved template/);
assert.throws(()=>buildPaperPdf({...paper,title:'Unsupported glyph 🧑'},false,fonts),/font does not support/);
console.log('PDF token and unsupported-glyph guards passed.');
