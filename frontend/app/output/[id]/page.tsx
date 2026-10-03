'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/ui/Topbar';
import { useAssignmentStore } from '@/store/assignmentStore';
import { api } from '@/lib/api';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Section, Question } from '@/types';
import toast from 'react-hot-toast';
import { Loader2, Download, RefreshCw, Copy, Check, ArrowLeft, CheckCircle } from 'lucide-react';


function RubricGuide({ a, onSaved }:{ a:any; onSaved:()=>void }){
  const qs:Question[] = (a.output.sections as Section[]).flatMap((sec:Section)=>sec.questions).filter((q:Question)=>q.rubric&&q.rubric.length===3);
  const [edit,setEdit] = useState<Record<string,{marks:number;descriptor:string;example:string}[]>>({});
  const [busy,setBusy] = useState('');
  if(qs.length===0) return null;
  const get = (q:Question)=> edit[q.id]||(q.rubric as any[]);
  const change = (q:Question,i:number,k:'marks'|'descriptor'|'example',v:string)=>{
    const cur = get(q).map(x=>({...x}));
    (cur[i] as any)[k] = k==='marks'?Number(v):v;
    setEdit(e=>({...e,[q.id]:cur}));
  };
  const save = async (q:Question)=>{
    const lv = get(q);
    if(lv.some(l=>!Number.isInteger(l.marks)||l.marks<0||l.marks>q.marks)){ toast.error(`Marks must be whole numbers from 0 to ${q.marks}`); return; }
    if(!(lv[0].marks>lv[1].marks&&lv[1].marks>lv[2].marks)){ toast.error('Levels must go from higher to lower marks'); return; }
    setBusy(q.id);
    try { await api.saveRubric(a._id||a.id, q.id, lv); toast.success('Marking guide saved'); setEdit(e=>{ const n={...e}; delete n[q.id]; return n; }); onSaved(); }
    catch(err:unknown){ toast.error(err instanceof Error?err.message:'Could not save'); }
    finally { setBusy(''); }
  };
  return (
    <div className="card fade-up" style={{ padding:'16px 20px', marginTop:14, maxWidth:760 }}>
      <h3 style={{ fontSize:14, fontWeight:700, color:'var(--black)', marginBottom:4 }}>Marking guide (AI draft for teacher review)</h3>
      <p style={{ fontSize:11, color:'var(--gray-500)', lineHeight:1.5, marginBottom:12 }}>For questions worth 3 or more marks. The AI wrote three levels with a sample answer each. The sample answers are made up to illustrate the levels, they are not student work, and they may contain mistakes or go beyond your notes. Edit anything, then save. You decide the final marks. Not shown in the PDF.</p>
      {qs.map((q,qi)=>(
        <div key={q.id} style={{ borderTop:qi?'1px solid var(--border)':'none', paddingTop:qi?12:0, marginTop:qi?12:0 }}>
          <p style={{ fontSize:13, fontWeight:600, color:'var(--black)', marginBottom:6 }}>{q.text} <span style={{ color:'var(--gray-500)', fontWeight:500 }}>[max {q.marks}]</span></p>
          {q.rubricEdited&&!edit[q.id]&&<p style={{ fontSize:11, color:'var(--gray-500)', marginBottom:6 }}>Edited by you.</p>}
          {q.evidence&&<p style={{ fontSize:11, color:'var(--gray-500)', fontStyle:'italic', marginBottom:6 }}>Source sentence the model says it used: &ldquo;{q.evidence}&rdquo;</p>}
          {get(q).map((l,i)=>(
            <div key={i} style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
              <input className="input" type="number" min={0} max={q.marks} value={l.marks} onChange={e=>change(q,i,'marks',e.target.value)} style={{ width:64, height:34, fontSize:13 }} aria-label={`Marks for level ${i+1}`}/>
              <div style={{ flex:'1 1 240px', minWidth:0, display:'flex', flexDirection:'column', gap:4 }}>
                <textarea className="input" value={l.descriptor} onChange={e=>change(q,i,'descriptor',e.target.value)} style={{ minHeight:84, fontSize:12 }} aria-label={`Description for level ${i+1}`}/>
                <textarea className="input" value={l.example} onChange={e=>change(q,i,'example',e.target.value)} style={{ minHeight:120, fontSize:12 }} aria-label={`Sample answer for level ${i+1}`}/>
              </div>
            </div>
          ))}
          {edit[q.id]&&<button className="btn btn-orange" onClick={()=>save(q)} disabled={busy===q.id} style={{ fontSize:12 }}>{busy===q.id?'Saving...':'Save changes'}</button>}
        </div>
      ))}
    </div>
  );
}

function GradingDemo({ a, onChanged }:{ a:any; onChanged:()=>void }){
  const [confirm, confirmNode] = useConfirm();
  const qs:Question[] = (a.output.sections as Section[]).flatMap((sec:Section)=>sec.questions).filter((q:Question)=>q.rubric&&q.rubric.length===3);
  const [ans,setAns] = useState<Record<string,string>>({});
  const [marks,setMarks] = useState<Record<string,string>>({});
  const [why,setWhy] = useState<Record<string,string>>({});
  const [busy,setBusy] = useState('');
  if(qs.length===0) return null;
  const id = a._id||a.id;
  const run = async (q:Question)=>{
    const f = ans[q.id]||'full';
    let overwrite = false;
    if(q.grade&&q.grade.edited){ if(!(await confirm('You already saved your own marks here. Grade again? Your earlier result is kept in history, but the draft is replaced.','Grade again'))) return; overwrite = true; }
    setBusy(q.id);
    try { await api.gradeAnswer(id, q.id, f, overwrite); toast.success('Draft marks ready for your review'); onChanged(); }
    catch(err:unknown){ toast.error(err instanceof Error?err.message:'Could not grade'); }
    finally { setBusy(''); }
  };
  const save = async (q:Question)=>{
    const g = q.grade!; const v = marks[q.id]!==undefined?Number(marks[q.id]):(g.teacherMarks??g.marks);
    if(!Number.isInteger(v)||v<0||v>q.marks){ toast.error(`Marks must be a whole number from 0 to ${q.marks}`); return; }
    setBusy(q.id);
    try { await api.saveGrade(id, q.id, v, why[q.id]??g.reason??''); toast.success('Your marks are saved'); onChanged(); }
    catch(err:unknown){ toast.error(err instanceof Error?err.message:'Could not save'); }
    finally { setBusy(''); }
  };
  return (
    <div className="card fade-up" style={{ padding:'16px 20px', marginTop:14, maxWidth:760 }}>
      {confirmNode}
      <h3 style={{ fontSize:14, fontWeight:700, color:'var(--black)', marginBottom:4 }}>Grading demo (synthetic answers only)</h3>
      <p style={{ fontSize:11, color:'var(--gray-500)', lineHeight:1.5, marginBottom:12 }}>Demo only, limited to one approved demo account. You pick one of three built-in made-up answers; you cannot type or upload your own. The built-in answer is sent to TypeSafe&apos;s Jev model, which picks the marking level that fits best. The draft marks and the confidence are the model&apos;s, they are not proof the marks are right. The confidence shows how sure the model is, not whether it is correct. You decide the final marks. Limited number of gradings per paper and per day.</p>
      {qs.map((q,qi)=>{ const g=q.grade; return (
        <div key={q.id} style={{ borderTop:qi?'1px solid var(--border)':'none', paddingTop:qi?12:0, marginTop:qi?12:0 }}>
          <p style={{ fontSize:13, fontWeight:600, color:'var(--black)', marginBottom:6 }}>{q.text} <span style={{ color:'var(--gray-500)', fontWeight:500 }}>[max {q.marks}]</span></p>
          <select className="input" value={ans[q.id]??'full'} onChange={e=>setAns(x=>({...x,[q.id]:e.target.value}))} style={{ height:34, fontSize:12, width:'100%' }} aria-label="Built-in synthetic answer"><option value="full">Built-in answer 1 (complete)</option><option value="partial">Built-in answer 2 (partial)</option><option value="weak">Built-in answer 3 (weak)</option></select>
          <button className="btn btn-orange" onClick={()=>run(q)} disabled={busy===q.id} style={{ fontSize:12, marginTop:6 }}>{busy===q.id?'Working...':(g?'Grade again':'Get draft marks')}</button>
          {g&&(
            <div style={{ marginTop:10, fontSize:12, color:'var(--gray-500)', lineHeight:1.6 }}>
              <p><b style={{ color:'var(--black)' }}>Draft marks: {g.marks} / {q.marks}</b> (level: {g.rubricSnapshot[g.levelIndex]?.descriptor})</p>
              <p>Model-reported confidence: {Math.round(g.confidence*100)}%{g.confidence<0.6?' (low, check this one carefully)':''}. Model: {g.model}, Jev Score question. Level chances: {g.rubricSnapshot.map((l,i)=>`${l.marks} marks ${Math.round((g.probabilities[String(i)]||0)*100)}%`).join(', ')}.</p>
              <p style={{ fontStyle:'italic' }}>Answer graded: &ldquo;{g.answer}&rdquo;</p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6, alignItems:'center' }}>
                <span>Your marks:</span>
                <input className="input" type="number" min={0} max={q.marks} value={marks[q.id]??String(g.teacherMarks??g.marks)} onChange={e=>setMarks(x=>({...x,[q.id]:e.target.value}))} style={{ width:64, height:34, fontSize:13 }} aria-label="Your marks"/>
                <input className="input" value={why[q.id]??g.reason??''} onChange={e=>setWhy(x=>({...x,[q.id]:e.target.value}))} placeholder="Reason (optional)" style={{ flex:'1 1 200px', height:34, fontSize:12 }} aria-label="Reason for marks"/>
                <button className="btn btn-orange" onClick={()=>save(q)} disabled={busy===q.id} style={{ fontSize:12 }}>Save my marks</button>
              </div>
              {g.edited&&<p style={{ marginTop:4 }}>Saved by you: {g.teacherMarks} / {q.marks}{g.reason?` - ${g.reason}`:''}</p>}
            </div>
          )}
        </div>
      ); })}
    </div>
  );
}

const DIFF_LABEL: Record<string,string> = { easy:'Easy', medium:'Moderate', hard:'Challenging' };

export default function OutputPage() {
  const { id } = useParams<{ id:string }>();
  const router = useRouter();
  const { currentAssignment, fetchAssignment, jobProgress, clientId, initWebSocket } = useAssignmentStore();
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [sectionVal, setSectionVal] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const [guideBusy,setGuideBusy] = useState(false);
  const pollRef = useRef<NodeJS.Timeout|null>(null);

  useEffect(()=>{ if(typeof window!=='undefined') initWebSocket(); fetchAssignment(id).finally(()=>setLoading(false)); },[id]);

  useEffect(()=>{
    const a = currentAssignment;
    if(a?.status==='pending'||a?.status==='processing'){
      pollRef.current = setInterval(()=>fetchAssignment(id),2500);
    } else { if(pollRef.current) clearInterval(pollRef.current); }
    return ()=>{ if(pollRef.current) clearInterval(pollRef.current); };
  },[currentAssignment?.status]);

  const handleDownload = async () => {
    if(!printRef.current) return;
    setDownloading(true);
    toast('Preparing PDF...');
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({ margin:[12,12,12,12], filename:`${currentAssignment?.title||'question-paper'}.pdf`, html2canvas:{ scale:2, useCORS:true, logging:false }, pagebreak:{ mode:['css','legacy'], avoid:['.avoid-break','h3'] }, jsPDF:{ unit:'mm', format:'a4', orientation:'portrait' } } as any).from(printRef.current).save();
      toast.success('PDF downloaded!');
    } catch { toast.error('PDF failed'); }
    finally { setDownloading(false); }
  };

  const handleGuideDownload = async () => {
    if(!guideRef.current) return;
    setGuideBusy(true);
    toast('Preparing teacher guide...');
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({ margin:[12,12,12,12], filename:`${currentAssignment?.title||'question-paper'} - teacher guide.pdf`, html2canvas:{ scale:2, useCORS:true, logging:false }, pagebreak:{ mode:['css','legacy'], avoid:['.avoid-break'] }, jsPDF:{ unit:'mm', format:'a4', orientation:'portrait' } } as any).from(guideRef.current).save();
      toast.success('Teacher guide downloaded!');
    } catch { toast.error('PDF failed'); }
    finally { setGuideBusy(false); }
  };

  const handleCopy = async () => {
    if(!currentAssignment?.output) return;
    const lines:string[] = [currentAssignment.title,`Subject: ${currentAssignment.output.subject}`,`Total Marks: ${currentAssignment.output.totalMarks}`,'',
      ...currentAssignment.output.sections.flatMap((s:Section)=>[`\n${s.title}`,s.instruction,'', ...s.questions.map((q:Question,i:number)=>`${i+1}. [${DIFF_LABEL[q.difficulty]||q.difficulty}] ${q.text} [${q.marks} Marks]${q.options&&q.options.length?'\n'+q.options.map((o:string,oi:number)=>`   (${String.fromCharCode(97+oi)}) ${o}`).join('\n'):''}`)])];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true); setTimeout(()=>setCopied(false),2000);
    toast.success('Copied to clipboard!');
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try { await api.regenerateAssignment(id,clientId||undefined); toast.success('Regenerating...'); await fetchAssignment(id); }
    catch { toast.error('Failed'); }
    finally { setRegenerating(false); }
  };

  const a = currentAssignment;
  const prog = jobProgress[id];
  const isProcessing = a?.status==='pending'||a?.status==='processing';
  const isFailed = a?.status==='failed';
  const isCompleted = a?.status==='completed';

  if(loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar/>
      <main className="main-content" style={{ marginLeft:248, flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>
          <Loader2 size={32} className="spin" style={{ color:'var(--orange)', margin:'0 auto 12px', display:'block' }}/>
          <p style={{ color:'var(--gray-400)', fontSize:13 }}>Loading...</p>
        </div>
      </main>
    </div>
  );

  if(!a) return null;

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar/>
      <main className="main-content" style={{ marginLeft:248, flex:1, minWidth:0 }}>
        <Topbar>
          <button className="btn btn-ghost btn-sm" onClick={()=>router.push('/assignments')} style={{ gap:6 }}>
            <ArrowLeft size={14}/> Back
          </button>
          {isCompleted&&(
            <>
              <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
                {copied?<><Check size={12} color="#22C55E"/> Copied</>:<><Copy size={12}/> Copy</>}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleRegenerate} disabled={regenerating}>
                <RefreshCw size={12} className={regenerating?'spin':''}/> Regenerate
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={downloading}>
                {downloading?<Loader2 size={12} className="spin"/>:<Download size={12}/>} Download PDF
              </button>
            </>
          )}
        </Topbar>

        <div style={{ padding:'20px 28px 60px' }}>

          {isProcessing&&(
            <div className="card fade-up" style={{ padding:'52px 40px', textAlign:'center', maxWidth:600 }}>
              <div style={{ position:'relative', width:80, height:80, margin:'0 auto 24px' }}>
                <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'3px solid var(--orange-dim)', animation:'glow 2s ease-in-out infinite' }}/>
                <div style={{ position:'absolute', inset:6, borderRadius:'50%', border:'2px solid var(--orange-border)' }}/>
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Loader2 size={28} className="spin" style={{ color:'var(--orange)' }}/>
                </div>
              </div>
              <h2 style={{ fontSize:18, fontWeight:700, color:'var(--black)', marginBottom:8 }}>Generating Your Question Paper</h2>
              <p style={{ color:'var(--gray-400)', fontSize:13, marginBottom:32, maxWidth:360, margin:'0 auto 32px', lineHeight:1.7 }}>
                AI is crafting <strong style={{ color:'var(--black)' }}>{a.numberOfQuestions} questions</strong> for <strong style={{ color:'var(--black)' }}>{a.subject}</strong>.
              </p>
              <p style={{ fontSize:13, color:'var(--gray-500)', margin:'0 auto', maxWidth:380, lineHeight:1.6 }}>
                {prog?.message ? `Server status: ${prog.message}` : 'Waiting for the server. Generation usually takes 1 to 3 minutes. This page checks every few seconds.'}
              </p>
            </div>
          )}

          {isFailed&&(
            <div className="card fade-up" style={{ padding:'40px', textAlign:'center', maxWidth:500, borderColor:'#FECACA', background:'#FEF2F2' }}>
              <h2 style={{ fontSize:17, fontWeight:700, color:'#DC2626', marginBottom:8 }}>Generation Failed</h2>
              <p style={{ color:'var(--gray-500)', fontSize:13, marginBottom:20, lineHeight:1.6 }}>{a.error||'All AI providers failed. Please try again.'}</p>
              <button className="btn" onClick={handleRegenerate} style={{ background:'#DC2626', color:'#fff', border:'none' }}>Try Again</button>
            </div>
          )}

          {isCompleted&&a.output&&(
            <div className="fade-up">
              {/* AI banner */}
              <div style={{ background:'var(--black)', borderRadius:12, padding:'16px 20px', marginBottom:20, maxWidth:760, display:'flex', alignItems:'flex-start', gap:12 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--orange)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <CheckCircle size={14} color="#fff"/>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, color:'#D1D5DB', lineHeight:1.6, marginBottom:12 }}>
                    Here is your customized Question Paper for <strong style={{ color:'#fff' }}>{a.output.subject}</strong> — <strong style={{ color:'#fff' }}>{a.numberOfQuestions} questions</strong>, {a.output.totalMarks} marks across {a.output.sections.length} sections.
                  </p>
                  <button className="btn btn-sm" onClick={handleDownload}
                    style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.18)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='rgba(255,255,255,0.1)')}>
                    <Download size={12}/> Download as PDF
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="stagger" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20, maxWidth:760 }}>
                {[{ label:'Total Marks', value:a.output.totalMarks },{ label:'Sections', value:a.output.sections.length },{ label:'Questions', value:a.numberOfQuestions },{ label:'Duration', value:a.output.duration||'2 hrs' }].map(({ label,value })=>(
                  <div key={label} className="card fade-up" style={{ padding:'14px 16px', textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:700, color:'var(--black)', marginBottom:2 }}>{value}</div>
                    <div style={{ fontSize:11, color:'var(--gray-400)' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Paper */}
              <div ref={printRef} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, maxWidth:760, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
                <div style={{ textAlign:'center', padding:'28px 48px 20px', borderBottom:'2.5px solid var(--black)' }}>
                  <h2 style={{ fontSize:17, fontWeight:700, color:'var(--black)', marginBottom:4 }}>{a.output.schoolName||a.title}</h2>
                  <p style={{ fontSize:14, color:'var(--gray-700)', marginBottom:2 }}>Subject: {a.output.subject}</p>
                  {a.output.grade&&<p style={{ fontSize:13, color:'var(--gray-500)' }}>Class: {a.output.grade}</p>}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'11px 48px', borderBottom:'1px solid var(--border)', fontSize:13, color:'var(--gray-700)' }}>
                  <span>Time Allowed: <strong>{a.output.duration||'45 minutes'}</strong></span>
                  <span>Maximum Marks: <strong>{a.output.totalMarks}</strong></span>
                </div>
                <div style={{ padding:'10px 48px', borderBottom:'1px solid var(--border)' }}>
                  <p style={{ fontSize:13, color:'var(--gray-700)', fontStyle:'italic' }}>All questions are compulsory unless stated otherwise.</p>
                </div>
                <div style={{ padding:'14px 48px', borderBottom:'2.5px solid var(--black)', display:'flex', flexDirection:'column', gap:7 }}>
                  {[{ label:'Name:', val:studentName, set:setStudentName, w:220 },{ label:'Roll Number:', val:rollNo, set:setRollNo, w:130 },{ label:(a.output.grade?`Class ${a.output.grade}, Section:`:'Class / Section:'), val:sectionVal, set:setSectionVal, w:80 }].map(({ label,val,set,w })=>(
                    <div key={label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                      <span style={{ color:'var(--gray-700)', fontWeight:500, minWidth:100 }}>{label}</span>
                      <input value={val} onChange={e=>set(e.target.value)}
                        style={{ width:w, padding:'2px 4px', border:'none', borderBottom:'1px solid #9CA3AF', outline:'none', fontSize:13, fontFamily:'Inter,sans-serif', background:'transparent', color:'var(--black)', transition:'border-color 0.15s' }}
                        onFocus={e=>(e.target.style.borderColor='#F97316')}
                        onBlur={e=>(e.target.style.borderColor='#9CA3AF')}/>
                    </div>
                  ))}
                </div>
                <div style={{ padding:'0 48px' }}>
                  {a.output.sections.map((sec:Section,si:number)=>{ const qOffset=a.output!.sections.slice(0,si).reduce((n:number,x:Section)=>n+x.questions.length,0); return (
                    <div key={si} style={{ paddingTop:22, paddingBottom:8, borderBottom:si<a.output!.sections.length-1?'1px dashed var(--border)':'none' }}>
                      <h3 style={{ fontSize:15, fontWeight:700, color:'var(--black)', textAlign:'center', marginBottom:2 }}>{sec.title}</h3>
                      <p style={{ fontSize:12, color:'var(--gray-500)', fontStyle:'italic', textAlign:'center', marginBottom:2 }}>{sec.instruction}</p>
                      <ol style={{ listStyle:'none', padding:0 }}>
                        {sec.questions.map((q:Question,qi:number)=>(
                          <li key={q.id||qi} className="avoid-break" style={{ breakInside:'avoid', pageBreakInside:'avoid', display:'flex', gap:8, marginBottom:12, fontSize:13, color:'var(--black)', lineHeight:1.6 }}>
                            <span style={{ fontWeight:600, minWidth:22, flexShrink:0, color:'var(--gray-700)' }}>{qOffset+qi+1}.</span>
                            <span>
                              <span style={{ color:'var(--gray-500)' }}>[{DIFF_LABEL[q.difficulty]||q.difficulty}] </span>
                              {q.text}
                              <span style={{ fontWeight:600, color:'var(--gray-700)' }}> [{q.marks} Mark{q.marks>1?'s':''}]</span>
                              {(a as any).fileContent&&(<div data-html2canvas-ignore="true" style={{ marginTop:6, fontSize:11, color:'var(--gray-500)', fontStyle:'italic' }}>{q.evidence?<>Sentence the model says it used (found word for word in your text; this does not prove the question follows from it): &ldquo;{q.evidence}&rdquo;</>:<>Review: no sentence from your source was matched to this question. Please check it yourself. (Copy check only, not a judgment of correctness.)</>}</div>)}
                              {q.options&&q.options.length>0&&(
                                <ol style={{ listStyle:'none', padding:0, margin:'6px 0 0' }}>
                                  {q.options.map((o:string,oi:number)=>(<li key={oi} style={{ marginBottom:2 }}>({String.fromCharCode(97+oi)}) {o}</li>))}
                                </ol>
                              )}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  );})}
                  <div className="avoid-break" style={{ textAlign:'center', padding:'16px 0', borderTop:'1px solid var(--border)', marginTop:8, breakInside:'avoid', pageBreakInside:'avoid' }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'var(--black)' }}>End of Question Paper</p>
                  </div>
                  {a.output.sections.some((sec:Section)=>sec.questions.some((q:Question)=>q.answer))&&(
                  <div data-html2canvas-ignore="true" style={{ padding:'20px 0', borderTop:'2px solid var(--black)' }}>
                    <h3 style={{ fontSize:14, fontWeight:700, color:'var(--black)', marginBottom:14 }}>Answer Key (teacher only, not in the student PDF):</h3>
                    <ol style={{ listStyle:'none', padding:0 }}>
                      {a.output.sections.flatMap((sec:Section)=>sec.questions).map((q:Question,i:number)=>q.answer?(
                        <li key={i} style={{ display:'flex', gap:8, marginBottom:8, fontSize:13, lineHeight:1.6 }}>
                          <span style={{ fontWeight:600, minWidth:22, flexShrink:0, color:'var(--gray-700)' }}>{i+1}.</span>
                          <span style={{ color:'var(--gray-700)' }}>
                            {q.answer}
                          </span>
                        </li>
                      ):null)}
                    </ol>
                  </div>
                  )}
                </div>
              </div>

              <div className="card fade-up" style={{ padding:'14px 20px', marginTop:14, maxWidth:760, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ flex:'1 1 260px' }}>
                  <p style={{ fontSize:13, fontWeight:600, color:'var(--black)' }}>Teacher answer guide (separate PDF)</p>
                  <p style={{ fontSize:11, color:'var(--gray-500)', lineHeight:1.5 }}>Answers, source sentences the model named, and marking levels. AI draft: check it before using. The student PDF does not include any of this.</p>
                </div>
                <button className="btn btn-ghost" onClick={handleGuideDownload} disabled={guideBusy} style={{ fontSize:12 }}>{guideBusy?<Loader2 size={12} className="spin"/>:<Download size={12}/>} Download guide PDF</button>
              </div>
              <div style={{ position:'absolute', left:-10000, top:0, width:700 }} aria-hidden="true">
                <div ref={guideRef} style={{ background:'#fff', color:'#111', padding:'8px 4px', fontSize:12, lineHeight:1.5 }}>
                  <h2 style={{ fontSize:16, fontWeight:700, textAlign:'center', marginBottom:2 }}>{a.title} - Teacher answer guide</h2>
                  <p style={{ fontSize:10, textAlign:'center', color:'#555', marginBottom:12 }}>AI draft for teacher review. Sample answers are illustrations, not student work. The teacher decides final marks.</p>
                  {(a.output.sections as Section[]).flatMap((sec:Section)=>sec.questions).map((q:Question,i:number)=>(
                    <div key={q.id||i} className="avoid-break" style={{ marginBottom:12, breakInside:'avoid', pageBreakInside:'avoid' }}>
                      <p style={{ fontWeight:700 }}>{i+1}. {q.text} <span style={{ fontWeight:400 }}>[{q.marks} mark{q.marks>1?'s':''}]</span></p>
                      {q.options&&q.options.length>0&&<p style={{ color:'#444' }}>{q.options.map((o:string,oi:number)=>`(${String.fromCharCode(97+oi)}) ${o}`).join('   ')}</p>}
                      {q.answer&&<p><b>Answer:</b> {q.answer}</p>}
                      {q.evidence&&<p style={{ fontSize:10, color:'#555', fontStyle:'italic' }}>Sentence the model says it used (found in the notes, not proof): &ldquo;{q.evidence}&rdquo;</p>}
                      {q.rubric&&q.rubric.length===3&&(
                        <div style={{ marginTop:4 }}>
                          <p style={{ fontWeight:600 }}>Marking levels{q.rubricEdited?' (edited by teacher)':' (AI draft)'}:</p>
                          {q.rubric.map((l,li)=>(<p key={li} style={{ marginLeft:8 }}><b>{l.marks} / {q.marks}:</b> {l.descriptor} <i>Sample answer: {l.example}</i></p>))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card fade-up" style={{ padding:'14px 20px', marginTop:14, maxWidth:760, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ flex:'1 1 260px' }}>
                  <p style={{ fontSize:13, fontWeight:600, color:'var(--black)' }}>Students and submissions</p>
                  <p style={{ fontSize:11, color:'var(--gray-500)', lineHeight:1.5 }}>Give each student an ID and an access code, let them submit typed answers, then mark them yourself. Answers are not sent to any AI service.</p>
                </div>
                <a className="btn btn-ghost" href={`/students?a=${a._id||(a as any).id}`} style={{ fontSize:12, textDecoration:'none' }}>Open students</a>
              </div>
              <RubricGuide key={JSON.stringify((a.output.sections as Section[]).flatMap((x:Section)=>x.questions.map((y:Question)=>y.rubric||null)))} a={a} onSaved={()=>{ api.getAssignment(a._id||(a as any).id).then(()=>window.location.reload()).catch(()=>window.location.reload()); }}/>

              <GradingDemo key={'g'+JSON.stringify((a.output.sections as Section[]).flatMap((x:Section)=>x.questions.map((y:Question)=>y.grade||null)))} a={a} onChanged={()=>window.location.reload()}/>

              {/* Difficulty breakdown */}
              <div className="card fade-up" style={{ padding:'14px 20px', marginTop:14, maxWidth:760, display:'flex', gap:20, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:12, color:'var(--gray-400)', fontWeight:500 }}>Difficulty breakdown:</span>
                {(['easy','medium','hard'] as const).map(d=>{
                  const count=a.output!.sections.flatMap((s:Section)=>s.questions).filter((q:Question)=>q.difficulty===d).length;
                  if(!count) return null;
                  const cls=d==='easy'?'badge-green':d==='medium'?'badge-yellow':'badge-red';
                  return <span key={d} className={`badge ${cls}`}>{count} {d.charAt(0).toUpperCase()+d.slice(1)}</span>;
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
