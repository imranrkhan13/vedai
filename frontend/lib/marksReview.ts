export type MarkInput={marks:string;reason:string};
export type MarkQuestion={id:string;marks:number;number?:number};
export function markErrors(questions:MarkQuestion[],inputs:Record<string,MarkInput>) {
  return Object.fromEntries(questions.flatMap(q=>{
    const raw=inputs[q.id]?.marks?.trim() ?? '',n=Number(raw);
    return raw==='' || !Number.isInteger(n) || n<0 || n>q.marks ? [[q.id,`Enter a whole number from 0 to ${q.marks}, including 0 for no credit.`]] : [];
  }));
}
export function hasUnsavedMarks(questions:MarkQuestion[],inputs:Record<string,MarkInput>,saved:Record<string,{marks:number;reason:string}>) {
  return questions.some(q=>!saved[q.id] || inputs[q.id]?.marks?.trim()==='' || Number(inputs[q.id]?.marks)!==saved[q.id].marks || (inputs[q.id]?.reason || '')!==(saved[q.id].reason || ''));
}
export function fillEmptySuggestions(inputs:Record<string,MarkInput>,drafts:Record<string,any>) {
 const next={...inputs};let added=0;
 for(const [id,d] of Object.entries(drafts)) if(d && ['exact','local-blank'].includes(d.gradingMethod) && !d.requiresReview && !d.uncertain?.length && !inputs[id]?.marks?.trim() && !inputs[id]?.reason?.trim()){next[id]={marks:String(d.marks),reason:d.reason};added++;}
 return {next,added};
}
