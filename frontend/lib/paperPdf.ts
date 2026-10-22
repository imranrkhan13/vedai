import { jsPDF } from 'jspdf';
import type { GeneratedOutput } from '../types';
import { sectionInstruction, unresolvedToken } from './paperText';
type Paper={title:string;output:GeneratedOutput};
type Names={name?:string;roll?:string;section?:string};
// The document is built from explicit student/teacher fields, never a screenshot of DOM.
export function buildPaperPdf(paper:Paper,teacher:boolean,fonts:{regular:string;bold:string},names:Names={}) {
 const pdf=new jsPDF({unit:'mm',format:'a4',compress:true});
 pdf.addFileToVFS('DejaVuSans.ttf',fonts.regular);pdf.addFont('DejaVuSans.ttf','DejaVu','normal');
 pdf.addFileToVFS('DejaVuSans-Bold.ttf',fonts.bold);pdf.addFont('DejaVuSans-Bold.ttf','DejaVu','bold');
 const margin=16,width=178,bottom=278;let y=18;
 const text=(value:string,size=10,bold=false,gap=2)=>{
  if(unresolvedToken.test(value))throw new Error('Unresolved template text. Review the paper before exporting.');
  pdf.setFont('DejaVu',bold?'bold':'normal');pdf.setFontSize(size);
  const metadata=pdf.getFont().metadata;
  for(const character of value)if(!/\s/.test(character) && !metadata.characterToGlyph(character.codePointAt(0)))throw new Error(`PDF font does not support ${character}. Edit the text before exporting; no characters were silently omitted.`);
  const lines=pdf.splitTextToSize(value,width) as string[];const leading=size*0.3528*1.45;
  for(const line of lines){if(y+leading>bottom){pdf.addPage();y=18;}pdf.text(line,margin,y);y+=leading;}y+=gap;
 };
 const reserve=(height:number)=>{if(y+Math.min(height,85)>bottom){pdf.addPage();y=18;}};
 const measure=(value:string,size=10)=>{pdf.setFont('DejaVu','normal');pdf.setFontSize(size);return pdf.splitTextToSize(value,width).length*size*.3528*1.45+2;};
 text(paper.title+(teacher?' - Teacher guide':''),16,true,3);
 text(`${paper.output.subject}${paper.output.grade?' | '+paper.output.grade:''} | ${paper.output.totalMarks} marks${paper.output.duration?' | '+paper.output.duration:''}`,10,false,3);
 if(teacher)text('AI draft for teacher review. Source excerpts are references, not proof of correctness. Teachers decide final marks.',9,false,4);
 else text(`Name: ${names.name || '____________________'}   Roll: ${names.roll || '________'}   Section: ${names.section || '________'}`,9,false,4);
 let number=0;
 for(const section of paper.output.sections){
  const first=section.questions[0];
  reserve(18+(first?measure(first.text)+(first.options || []).reduce((n,o)=>n+measure(o),0)+(teacher?18:0):0));text(section.title,12,true);text(sectionInstruction(section.questions),9,false,3);
  for(const q of section.questions){
   number++;const heading=`${number}. ${q.text} [${q.marks} mark${q.marks===1?'':'s'}]`;
   if(unresolvedToken.test(heading))throw new Error('Unresolved template text. Review this question before exporting.');
   const options=(q.options || []).map((o,i)=>`(${String.fromCharCode(97+i)}) ${o}`);
   const guideText=teacher?[`Answer: ${q.answer || ''}`,...(q.markingPoints || []).map(p=>p.text),...(q.rubric || []).map(r=>r.descriptor+' '+r.example),q.evidence || ''].join(' '):'';
   reserve(measure(heading)+options.reduce((n,o)=>n+measure(o),0)+5+(teacher?measure(guideText)+22:0));
   text(heading,10,true,1);options.forEach(o=>text(o,10,false,0));y+=3;
   if(teacher){
    text(`Answer: ${q.answer || 'Teacher review required: no reference answer.'}`,10,false,2);
    q.markingPoints?.forEach(p=>text(`Criterion (${p.marks} marks): ${p.text}`,9,false,1));
    if(q.markingPoints?.length)text('Partial credit: award each demonstrated criterion once. Accept equivalent valid answers; do not reward repeated ideas or question text. Review any uncertain or defective criterion.',9,false,2);
    if(q.evidence)text(`Source excerpt (not proof): ${q.evidence}`,9,false,2);
    q.rubric?.forEach(r=>text(`${r.marks}/${q.marks}: ${r.descriptor} Example: ${r.example}`,9,false,2));
   }
   y+=3;
  }
 }
 const pages=pdf.getNumberOfPages();for(let page=1;page<=pages;page++){pdf.setPage(page);pdf.setFont('DejaVu','normal');pdf.setFontSize(8);pdf.text(`${teacher?'Teacher guide':'Student paper'} | ${page} / ${pages}`,margin,289);}
 return pdf;
}
export async function downloadPaperPdf(paper:Paper,teacher:boolean,names:Names={}) {
 const encode=async(path:string)=>{const r=await fetch(path);if(!r.ok)throw new Error('PDF font failed to load. Try again.');const data=new Uint8Array(await r.arrayBuffer());let binary='';for(const b of data)binary+=String.fromCharCode(b);return btoa(binary);};
 const [regular,bold]=await Promise.all([encode('/fonts/DejaVuSans.ttf'),encode('/fonts/DejaVuSans-Bold.ttf')]);
 buildPaperPdf(paper,teacher,{regular,bold},names).save(`${paper.title}${teacher?' - teacher guide':''}.pdf`);
}
