'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/ui/Topbar';
import { useAssignmentStore } from '@/store/assignmentStore';
import { api } from '@/lib/api';
import { Section, Question, Assignment } from '@/types';
import toast from 'react-hot-toast';
import { Pencil, Check, X, Plus, Trash2, Download, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';

type EQ = Question & { _editing?:boolean; _editText?:string };
type ES = Omit<Section,'questions'> & { questions:EQ[] };

function DiffBadge({ d }:{ d:string }) {
  const cls = d==='easy'?'badge-green':d==='hard'?'badge-red':'badge-yellow';
  return <span className={`badge ${cls}`} style={{ textTransform:'capitalize' }}>{d}</span>;
}

export default function AIToolkitPage() {
  const { assignments, fetchAssignments } = useAssignmentStore();
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Assignment|null>(null);
  const [sections, setSections] = useState<ES[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(()=>{ fetchAssignments().finally(()=>setLoading(false)); },[]);

  const completed = assignments.filter(a=>a.status==='completed');

  const loadAssignment = async (a:Assignment) => {
    try {
      const full = await api.getAssignment(a._id);
      setSelected(full);
      setSections((full.output?.sections||[]).map((s:Section)=>({ ...s, questions:s.questions.map((q:Question)=>({ ...q })) })));
      toast.success(`Loaded: ${a.title}`);
    } catch { toast.error('Failed to load'); }
  };

  const startEditQ  = (si:number,qi:number) => setSections(s=>s.map((sec,i)=>i!==si?sec:{...sec,questions:sec.questions.map((q,j)=>j!==qi?q:{...q,_editing:true,_editText:q.text})}));
  const saveQ       = (si:number,qi:number) => setSections(s=>s.map((sec,i)=>i!==si?sec:{...sec,questions:sec.questions.map((q,j)=>j!==qi?q:{...q,text:q._editText??q.text,_editing:false})}));
  const cancelQ     = (si:number,qi:number) => setSections(s=>s.map((sec,i)=>i!==si?sec:{...sec,questions:sec.questions.map((q,j)=>j!==qi?q:{...q,_editing:false})}));
  const deleteQ     = (si:number,qi:number) => setSections(s=>s.map((sec,i)=>i!==si?sec:{...sec,questions:sec.questions.filter((_,j)=>j!==qi)}));
  const updateQF    = (si:number,qi:number,field:keyof Question,val:string|number) => setSections(s=>s.map((sec,i)=>i!==si?sec:{...sec,questions:sec.questions.map((q,j)=>j!==qi?q:{...q,[field]:val})}));
  const addQuestion = (si:number) => setSections(s=>s.map((sec,i)=>i!==si?sec:{...sec,questions:[...sec.questions,{ id:`new_${Date.now()}`, text:'New question', difficulty:'medium', marks:2, type:'short', _editing:true, _editText:'New question' }]}));
  const addSection  = () => setSections(s=>[...s,{ title:`Section ${String.fromCharCode(65+s.length)}`, instruction:'Attempt all questions.', questions:[], totalMarks:0 }]);
  const deleteSection=(si:number)=>setSections(s=>s.filter((_,i)=>i!==si));
  const updateTitle =(si:number,val:string)=>setSections(s=>s.map((sec,i)=>i!==si?sec:{...sec,title:val}));

  const handleDownload = async () => {
    const el = document.getElementById('toolkit-paper');
    if(!el) return;
    setDownloading(true);
    try {
      const html2pdf=(await import('html2pdf.js')).default;
      await html2pdf().set({ margin:[12,12], filename:`${selected?.title||'paper'}-edited.pdf`, html2canvas:{ scale:2 }, jsPDF:{ unit:'mm', format:'a4' } }).from(el).save();
      toast.success('PDF downloaded!');
    } catch { toast.error('PDF failed'); }
    finally { setDownloading(false); }
  };

  const totalMarks=sections.reduce((a,s)=>a+s.questions.reduce((b,q)=>b+q.marks,0),0);
  const totalQs=sections.reduce((a,s)=>a+s.questions.length,0);

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar/>
      <main className="main-content" style={{ marginLeft:248, flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Topbar title="AI Teacher's Toolkit">
          <button className="btn btn-ghost btn-sm" onClick={()=>setPanelOpen(p=>!p)}>
            {panelOpen?<ChevronLeft size={13}/>:<ChevronRight size={13}/>} {panelOpen?'Hide panel':'Show panel'}
          </button>
          {selected&&(
            <>
              <button className="btn btn-ghost btn-sm" onClick={addSection}><Plus size={12}/> Add Section</button>
              <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={downloading}>
                {downloading?<Loader2 size={12} className="spin"/>:<Download size={12}/>} Download PDF
              </button>
            </>
          )}
        </Topbar>

        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          {/* Left panel */}
          <div style={{ width:panelOpen?256:0, flexShrink:0, overflow:'hidden', transition:'width 0.25s cubic-bezier(0.22,1,0.36,1)', borderRight:'1px solid var(--border)', background:'#fff' }}>
            <div style={{ width:256, padding:'16px 14px', height:'100%', overflow:'auto' }}>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--black)', marginBottom:14 }}>Select Assignment</p>
              {loading&&<div className="skeleton" style={{ height:60, marginBottom:8 }}/>}
              {!loading&&completed.length===0&&(
                <div style={{ textAlign:'center', padding:'32px 16px', color:'var(--gray-400)', fontSize:13, lineHeight:1.6 }}>No completed assignments yet.</div>
              )}
              <div className="stagger">
                {completed.map(a=>(
                  <div key={a._id} className="fade-in" onClick={()=>loadAssignment(a)}
                    style={{ padding:'10px 12px', borderRadius:9, marginBottom:6, cursor:'pointer', background:selected?._id===a._id?'var(--orange-dim)':'var(--gray-50)', border:`1.5px solid ${selected?._id===a._id?'var(--orange)':'transparent'}`, transition:'all 0.15s' }}
                    onMouseEnter={e=>{ if(selected?._id!==a._id)(e.currentTarget as HTMLDivElement).style.borderColor='var(--orange-border)'; }}
                    onMouseLeave={e=>{ if(selected?._id!==a._id)(e.currentTarget as HTMLDivElement).style.borderColor='transparent'; }}>
                    <p style={{ fontSize:13, fontWeight:600, color:'var(--black)', marginBottom:2 }}>{a.title}</p>
                    <p style={{ fontSize:11, color:'var(--gray-400)' }}>{a.subject} · {a.numberOfQuestions}Q · {a.totalMarks}M</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Editor */}
          <div style={{ flex:1, overflow:'auto', padding:'20px 28px 60px' }}>
            {!selected&&(
              <div className="card fade-up" style={{ padding:'72px 40px', textAlign:'center', maxWidth:480 }}>
                <div className="float" style={{ width:64, height:64, background:'var(--orange-dim)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
                  <Pencil size={24} color="#F97316"/>
                </div>
                <h2 style={{ fontSize:17, fontWeight:700, color:'var(--black)', marginBottom:8 }}>AI Teacher&apos;s Toolkit</h2>
                <p style={{ color:'var(--gray-400)', fontSize:13, lineHeight:1.6, maxWidth:300, margin:'0 auto' }}>
                  Select a completed assignment from the panel to edit questions, change marks and difficulty, add sections, and download as PDF.
                </p>
              </div>
            )}

            {selected&&sections.length>0&&(
              <>
                <div className="fade-up" style={{ marginBottom:18 }}>
                  <h1 style={{ fontSize:18, fontWeight:700, color:'var(--black)', marginBottom:3 }}>{selected.title}</h1>
                  <p style={{ fontSize:12, color:'var(--gray-400)' }}>{totalQs} questions · {totalMarks} marks total</p>
                </div>

                <div id="toolkit-paper" className="card fade-up" style={{ padding:'28px 36px', maxWidth:760 }}>
                  <div style={{ textAlign:'center', paddingBottom:16, borderBottom:'2px solid var(--black)', marginBottom:20 }}>
                    <h2 style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Delhi Public School, Sector-4, Bokaro</h2>
                    <p style={{ fontSize:14, color:'var(--gray-700)', marginBottom:8 }}>Subject: {selected.subject}</p>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--gray-700)' }}>
                      <span>Time Allowed: {selected.output?.duration||'2 hours'}</span>
                      <span>Maximum Marks: {totalMarks}</span>
                    </div>
                  </div>

                  <div className="stagger">
                    {sections.map((sec,si)=>(
                      <div key={si} className="fade-up" style={{ marginBottom:28 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <input value={sec.title} onChange={e=>updateTitle(si,e.target.value)} className="input"
                            style={{ fontSize:15, fontWeight:700, border:'1.5px solid transparent', background:'transparent', padding:'3px 8px', flex:1 }}
                            onFocus={e=>(e.target.style.borderColor='var(--orange)')}
                            onBlur={e=>(e.target.style.borderColor='transparent')}/>
                          <button className="btn btn-danger btn-sm" onClick={()=>deleteSection(si)} style={{ padding:'4px 8px' }}>
                            <Trash2 size={13}/>
                          </button>
                        </div>
                        <p style={{ fontSize:12, color:'var(--gray-400)', fontStyle:'italic', marginBottom:14, paddingLeft:4 }}>{sec.instruction}</p>

                        <div className="stagger">
                          {sec.questions.map((q,qi)=>(
                            <div key={q.id||qi} className="fade-in"
                              style={{ display:'flex', gap:8, marginBottom:10, padding:'12px 14px', background:'var(--gray-50)', borderRadius:9, border:'1.5px solid var(--border)', transition:'border-color 0.15s', alignItems:'flex-start' }}
                              onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--gray-400)')}
                              onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}>
                              <span style={{ fontSize:13, fontWeight:700, color:'var(--orange)', minWidth:22, paddingTop:1, flexShrink:0 }}>{qi+1}.</span>
                              <div style={{ flex:1, minWidth:0 }}>
                                {q._editing?(
                                  <textarea value={q._editText}
                                    onChange={e=>setSections(s=>s.map((sec2,i)=>i!==si?sec2:{...sec2,questions:sec2.questions.map((q2,j)=>j!==qi?q2:{...q2,_editText:e.target.value})}))}
                                    className="input" autoFocus style={{ width:'100%', minHeight:72, marginBottom:8, borderColor:'var(--orange)' }}/>
                                ):(
                                  <p style={{ fontSize:13, color:'var(--black)', lineHeight:1.6, marginBottom:8 }}>{q.text}</p>
                                )}
                                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                  <DiffBadge d={q.difficulty}/>
                                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                    <span style={{ fontSize:11, color:'var(--gray-400)' }}>Marks:</span>
                                    <input type="number" min={1} value={q.marks} onChange={e=>updateQF(si,qi,'marks',parseInt(e.target.value)||1)}
                                      className="input" style={{ width:52, padding:'3px 7px', fontSize:12, textAlign:'center', height:28 }}/>
                                  </div>
                                  <select value={q.difficulty} onChange={e=>updateQF(si,qi,'difficulty',e.target.value)}
                                    className="input" style={{ fontSize:11, padding:'3px 22px 3px 7px', height:28, width:'auto', cursor:'pointer' }}>
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                  </select>
                                </div>
                              </div>
                              <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                                {q._editing?(
                                  <>
                                    <button className="btn btn-sm" onClick={()=>saveQ(si,qi)} style={{ width:28, height:28, padding:0, background:'#F0FDF4', border:'1px solid #BBF7D0', color:'#15803D' }}><Check size={12}/></button>
                                    <button className="btn btn-sm" onClick={()=>cancelQ(si,qi)} style={{ width:28, height:28, padding:0, background:'#FEF2F2', border:'1px solid #FECACA', color:'#DC2626' }}><X size={12}/></button>
                                  </>
                                ):(
                                  <>
                                    <button className="btn btn-ghost btn-sm" onClick={()=>startEditQ(si,qi)} style={{ width:28, height:28, padding:0 }}><Pencil size={12}/></button>
                                    <button className="btn btn-danger btn-sm" onClick={()=>deleteQ(si,qi)} style={{ width:28, height:28, padding:0 }}><Trash2 size={12}/></button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <button onClick={()=>addQuestion(si)}
                          style={{ display:'flex', alignItems:'center', gap:6, marginTop:6, padding:'7px 12px', background:'none', border:'1.5px dashed var(--gray-200)', borderRadius:8, cursor:'pointer', color:'var(--gray-400)', fontSize:12, fontFamily:'Inter,sans-serif', transition:'all 0.15s' }}
                          onMouseEnter={e=>{(e.currentTarget.style.borderColor='var(--orange)');(e.currentTarget.style.color='var(--orange)');(e.currentTarget.style.background='var(--orange-dim)');}}
                          onMouseLeave={e=>{(e.currentTarget.style.borderColor='var(--gray-200)');(e.currentTarget.style.color='var(--gray-400)');(e.currentTarget.style.background='none');}}>
                          <Plus size={13}/> Add Question
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ textAlign:'center', paddingTop:14, borderTop:'1px solid var(--border)' }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'var(--black)' }}>End of Question Paper</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
