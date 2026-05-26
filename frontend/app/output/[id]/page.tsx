'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/ui/Topbar';
import { useAssignmentStore } from '@/store/assignmentStore';
import { api } from '@/lib/api';
import { Section, Question } from '@/types';
import toast from 'react-hot-toast';
import { Loader2, Download, RefreshCw, Copy, Check, ArrowLeft, CheckCircle } from 'lucide-react';

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
      await html2pdf().set({ margin:[12,12,12,12], filename:`${currentAssignment?.title||'question-paper'}.pdf`, html2canvas:{ scale:2, useCORS:true, logging:false }, jsPDF:{ unit:'mm', format:'a4', orientation:'portrait' } }).from(printRef.current).save();
      toast.success('PDF downloaded!');
    } catch { toast.error('PDF failed'); }
    finally { setDownloading(false); }
  };

  const handleCopy = async () => {
    if(!currentAssignment?.output) return;
    const lines:string[] = [currentAssignment.title,`Subject: ${currentAssignment.output.subject}`,`Total Marks: ${currentAssignment.output.totalMarks}`,'',
      ...currentAssignment.output.sections.flatMap((s:Section)=>[`\n${s.title}`,s.instruction,'', ...s.questions.map((q:Question,i:number)=>`${i+1}. [${DIFF_LABEL[q.difficulty]||q.difficulty}] ${q.text} [${q.marks} Marks]`)])];
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
  const progressPct = prog?.progress||(a?.status==='processing'?40:10);
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
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:0, marginBottom:28, maxWidth:420, margin:'0 auto 28px' }}>
                {['Analysing','Structuring','Writing','Finalising'].map((step,i)=>{
                  const stepPct=(i+1)*25; const done=progressPct>=stepPct; const active=progressPct>=i*25&&progressPct<stepPct;
                  return (
                    <div key={step} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', position:'relative' }}>
                      {i>0&&<div style={{ position:'absolute', left:0, top:14, width:'50%', height:2, background:done?'var(--orange)':'var(--gray-200)', transition:'background 0.4s' }}/>}
                      {i<3&&<div style={{ position:'absolute', right:0, top:14, width:'50%', height:2, background:done&&i<3?'var(--orange)':'var(--gray-200)', transition:'background 0.4s' }}/>}
                      <div style={{ width:28, height:28, borderRadius:'50%', zIndex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, transition:'all 0.3s', background:done?'var(--orange)':active?'var(--orange-dim)':'var(--gray-100)', border:`2px solid ${done||active?'var(--orange)':'var(--gray-200)'}`, color:done?'#fff':active?'var(--orange)':'var(--gray-400)', marginBottom:6 }}>
                        {done?'✓':i+1}
                      </div>
                      <span style={{ fontSize:10, color:done||active?'var(--orange)':'var(--gray-400)', fontWeight:done||active?600:400 }}>{step}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ maxWidth:360, margin:'0 auto' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--gray-400)', marginBottom:6 }}>
                  <span>{prog?.message||'Processing...'}</span>
                  <span style={{ color:'var(--orange)', fontWeight:700 }}>{progressPct}%</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width:`${progressPct}%` }}/></div>
              </div>
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
                  <h2 style={{ fontSize:17, fontWeight:700, color:'var(--black)', marginBottom:4 }}>Delhi Public School, Sector-4, Bokaro</h2>
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
                  {[{ label:'Name:', val:studentName, set:setStudentName, w:220 },{ label:'Roll Number:', val:rollNo, set:setRollNo, w:130 },{ label:`Class: ${a.output.grade||'5th'} Section:`, val:sectionVal, set:setSectionVal, w:80 }].map(({ label,val,set,w })=>(
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
                  {a.output.sections.map((sec:Section,si:number)=>(
                    <div key={si} style={{ paddingTop:22, paddingBottom:8, borderBottom:si<a.output!.sections.length-1?'1px dashed var(--border)':'none' }}>
                      <h3 style={{ fontSize:15, fontWeight:700, color:'var(--black)', textAlign:'center', marginBottom:2 }}>{sec.title}</h3>
                      <p style={{ fontSize:12, color:'var(--gray-500)', fontStyle:'italic', textAlign:'center', marginBottom:2 }}>{sec.instruction}</p>
                      {sec.questions[0]&&<p style={{ fontSize:12, color:'var(--gray-500)', textAlign:'center', marginBottom:16 }}>Each question carries {sec.questions[0].marks} mark{sec.questions[0].marks>1?'s':''}.</p>}
                      <ol style={{ listStyle:'none', padding:0 }}>
                        {sec.questions.map((q:Question,qi:number)=>(
                          <li key={q.id||qi} style={{ display:'flex', gap:8, marginBottom:12, fontSize:13, color:'var(--black)', lineHeight:1.6 }}>
                            <span style={{ fontWeight:600, minWidth:22, flexShrink:0, color:'var(--gray-700)' }}>{qi+1}.</span>
                            <span>
                              <span style={{ color:'var(--gray-500)' }}>[{DIFF_LABEL[q.difficulty]||q.difficulty}] </span>
                              {q.text}
                              <span style={{ fontWeight:600, color:'var(--gray-700)' }}> [{q.marks} Mark{q.marks>1?'s':''}]</span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                  <div style={{ textAlign:'center', padding:'16px 0', borderTop:'1px solid var(--border)', marginTop:8 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'var(--black)' }}>End of Question Paper</p>
                  </div>
                  <div style={{ padding:'20px 0', borderTop:'2px solid var(--black)' }}>
                    <h3 style={{ fontSize:14, fontWeight:700, color:'var(--black)', marginBottom:14 }}>Answer Key:</h3>
                    <ol style={{ listStyle:'none', padding:0 }}>
                      {a.output.sections.flatMap((sec:Section)=>sec.questions).map((q:Question,i:number)=>(
                        <li key={i} style={{ display:'flex', gap:8, marginBottom:8, fontSize:13, lineHeight:1.6 }}>
                          <span style={{ fontWeight:600, minWidth:22, flexShrink:0, color:'var(--gray-700)' }}>{i+1}.</span>
                          <span style={{ color:'var(--gray-500)', fontStyle:'italic' }}>
                            {q.difficulty==='easy'?`Basic understanding of ${a.subject.toLowerCase()} concepts.`:q.difficulty==='hard'?`Advanced analysis and application in ${a.subject.toLowerCase()}.`:`Core application of ${a.subject.toLowerCase()} principles.`}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>

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
