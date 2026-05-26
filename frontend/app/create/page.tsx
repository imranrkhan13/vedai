'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/ui/Topbar';
import { useAssignmentStore } from '@/store/assignmentStore';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Upload, X, Loader2, Plus, Minus } from 'lucide-react';

const Q_TYPES = ['Multiple Choice Questions','Short Questions','Long Answer Questions','Diagram/Graph-Based Questions','Numerical Problems','True/False','Fill in the Blank','Essay'];
interface QRow { type:string; qty:number; marks:number; }

function Stepper({ value, onChange }: { value:number; onChange:(v:number)=>void }) {
  return (
    <div className="stepper">
      <button className="stepper-btn" onClick={()=>onChange(Math.max(1,value-1))}><Minus size={11}/></button>
      <span className="stepper-val">{value}</span>
      <button className="stepper-btn" onClick={()=>onChange(value+1)}><Plus size={11}/></button>
    </div>
  );
}

export default function CreatePage() {
  const router = useRouter();
  const { clientId, initWebSocket } = useAssignmentStore();
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [qRows, setQRows] = useState<QRow[]>([
    { type:'Multiple Choice Questions', qty:4, marks:1 },
    { type:'Short Questions', qty:3, marks:2 },
  ]);

  useEffect(()=>{ if(typeof window!=='undefined') initWebSocket(); },[]);

  const totalQ = qRows.reduce((s,r)=>s+r.qty,0);
  const totalM = qRows.reduce((s,r)=>s+r.qty*r.marks,0);

  const addRow = () => {
    const used = qRows.map(r=>r.type);
    const next = Q_TYPES.find(t=>!used.includes(t))||Q_TYPES[0];
    setQRows(r=>[...r,{ type:next, qty:4, marks:1 }]);
  };
  const removeRow = (i:number) => setQRows(r=>r.filter((_,idx)=>idx!==i));
  const updateRow = (i:number, key:keyof QRow, val:string|number) =>
    setQRows(r=>r.map((row,idx)=>idx===i?{...row,[key]:val}:row));

  const readFile = (file:File) => {
    if(file.size>10*1024*1024){ toast.error('Max 10MB'); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setFileContent(ev.target?.result as string||'');
    reader.readAsText(file);
  };

  const validate = () => {
    const e:Record<string,string> = {};
    if(!subject.trim()) e.subject='Required';
    if(!dueDate) e.dueDate='Required';
    if(qRows.length===0) e.qRows='Add at least one question type';
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const handleSubmit = async () => {
    if(!validate()){ toast.error('Please fix the errors'); return; }
    setSubmitting(true);
    try {
      const result = await api.createAssignment({
        title: title.trim()||`${subject} Assessment`,
        subject, dueDate,
        questionTypes: qRows.map(r=>r.type),
        numberOfQuestions: totalQ, totalMarks: totalM,
        difficulty: 'mixed',
        additionalInstructions: additionalInfo||undefined,
        fileContent: fileContent||undefined,
        clientId: clientId||undefined,
      });
      toast.success('Generating question paper...');
      router.push(`/output/${result.id}`);
    } catch(err:unknown){
      toast.error(err instanceof Error?err.message:'Failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar/>
      <main className="main-content" style={{ marginLeft:248, flex:1, minWidth:0 }}>
        <Topbar breadcrumb="Assignment" />

        <div style={{ padding:'0 28px 60px', maxWidth:760 }}>
          <div style={{ padding:'20px 0 4px' }} className="fade-up">
            <h1 style={{ fontSize:20, fontWeight:700, color:'var(--black)', marginBottom:3 }}>Create Assignment</h1>
            <p style={{ fontSize:13, color:'var(--gray-400)' }}>Set up a new assignment for your students.</p>
          </div>

          {/* Tabs */}
          <div className="fade-up" style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:20, marginTop:4 }}>
            {['Assignment Details','Review'].map((t,i)=>(
              <div key={t} style={{ padding:'10px 16px', fontSize:13, fontWeight:i===0?600:400, color:i===0?'var(--orange)':'var(--gray-400)', borderBottom:i===0?'2px solid var(--orange)':'2px solid transparent', cursor:'pointer' }}>{t}</div>
            ))}
          </div>

          {/* Details card */}
          <div className="card fade-up" style={{ padding:'20px 22px', marginBottom:14 }}>
            <h2 style={{ fontSize:14, fontWeight:600, marginBottom:3, color:'var(--black)' }}>Assignment Details</h2>
            <p style={{ fontSize:12, color:'var(--gray-400)', marginBottom:18 }}>Basic information about your assignment</p>

            <input ref={fileRef} type="file" accept=".txt,.pdf,.png,.jpg,.jpeg" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&readFile(e.target.files[0])}/>
            {!fileName?(
              <div onClick={()=>fileRef.current?.click()}
                onDragOver={e=>{e.preventDefault();setDragOver(true);}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)readFile(f);}}
                style={{ border:`2px dashed ${dragOver?'var(--orange)':'var(--gray-200)'}`, borderRadius:10, padding:'28px 20px', textAlign:'center', cursor:'pointer', marginBottom:16, background:dragOver?'var(--orange-dim)':'var(--gray-50)', transition:'all 0.2s' }}>
                <div style={{ width:38, height:38, background:'var(--gray-100)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px', transition:'transform 0.2s' }}>
                  <Upload size={16} color="#9CA3AF"/>
                </div>
                <p style={{ fontSize:13, color:'var(--gray-500)', marginBottom:4 }}>Choose a file or drag &amp; drop it here</p>
                <p style={{ fontSize:11, color:'var(--gray-400)', marginBottom:12 }}>JPEG, PNG, PDF, TXT up to 10MB</p>
                <button className="btn btn-ghost btn-sm" type="button" onClick={e=>{e.stopPropagation();fileRef.current?.click();}}>Browse Files</button>
              </div>
            ):(
              <div className="fade-in" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--orange-dim)', borderRadius:8, border:'1px solid var(--orange-border)', marginBottom:16 }}>
                <span style={{ fontSize:18 }}>📄</span>
                <span style={{ flex:1, fontSize:13, fontWeight:500, color:'var(--black)' }}>{fileName}</span>
                <button onClick={()=>{setFileName('');setFileContent('');}} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', padding:4, borderRadius:5, display:'flex', transition:'color 0.12s' }}
                  onMouseEnter={e=>(e.currentTarget.style.color='#EF4444')}
                  onMouseLeave={e=>(e.currentTarget.style.color='var(--gray-400)')}>
                  <X size={14}/>
                </button>
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:500, color:'var(--gray-700)', display:'block', marginBottom:5 }}>Subject *</label>
                <input className={`input ${errors.subject?'input-error':''}`} placeholder="e.g. Physics, Mathematics"
                  value={subject} onChange={e=>setSubject(e.target.value)}/>
                {errors.subject&&<p style={{ color:'var(--red)', fontSize:11, marginTop:3 }}>{errors.subject}</p>}
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:500, color:'var(--gray-700)', display:'block', marginBottom:5 }}>Title (optional)</label>
                <input className="input" placeholder="e.g. Quiz on Electricity" value={title} onChange={e=>setTitle(e.target.value)}/>
              </div>
            </div>

            <div style={{ maxWidth:260 }}>
              <label style={{ fontSize:12, fontWeight:500, color:'var(--gray-700)', display:'block', marginBottom:5 }}>Due Date *</label>
              <input type="date" className={`input ${errors.dueDate?'input-error':''}`} value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
              {errors.dueDate&&<p style={{ color:'var(--red)', fontSize:11, marginTop:3 }}>{errors.dueDate}</p>}
            </div>
          </div>

          {/* Question types card */}
          <div className="card fade-up" style={{ padding:'20px 22px', marginBottom:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 100px 36px', gap:8, marginBottom:10, padding:'0 4px' }}>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--gray-500)' }}>Question Type</span>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--gray-500)', textAlign:'center' }}>No. of Questions</span>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--gray-500)', textAlign:'center' }}>Marks</span>
              <span/>
            </div>
            {errors.qRows&&<p style={{ color:'var(--red)', fontSize:12, marginBottom:8 }}>{errors.qRows}</p>}
            <div className="stagger">
              {qRows.map((row,i)=>(
                <div key={i} className="fade-up" style={{ display:'grid', gridTemplateColumns:'1fr 120px 100px 36px', gap:8, marginBottom:8, alignItems:'center' }}>
                  <select className="input" value={row.type} onChange={e=>updateRow(i,'type',e.target.value)} style={{ height:36, fontSize:13, padding:'0 28px 0 10px' }}>
                    {Q_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <Stepper value={row.qty} onChange={v=>updateRow(i,'qty',v)}/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <Stepper value={row.marks} onChange={v=>updateRow(i,'marks',v)}/>
                  </div>
                  <button onClick={()=>removeRow(i)}
                    style={{ width:32, height:32, background:'none', border:'1.5px solid var(--gray-200)', borderRadius:7, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gray-400)', transition:'all 0.15s' }}
                    onMouseEnter={e=>{(e.currentTarget.style.borderColor='#FECACA');(e.currentTarget.style.color='#DC2626');(e.currentTarget.style.background='#FEF2F2');}}
                    onMouseLeave={e=>{(e.currentTarget.style.borderColor='var(--gray-200)');(e.currentTarget.style.color='var(--gray-400)');(e.currentTarget.style.background='none');}}>
                    <X size={13}/>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addRow}
              style={{ display:'flex', alignItems:'center', gap:6, marginTop:12, padding:'7px 12px', background:'none', border:'1.5px dashed var(--gray-200)', borderRadius:8, cursor:'pointer', color:'var(--gray-500)', fontSize:13, fontFamily:'Inter,sans-serif', fontWeight:500, transition:'all 0.15s' }}
              onMouseEnter={e=>{(e.currentTarget.style.borderColor='var(--orange)');(e.currentTarget.style.color='var(--orange)');(e.currentTarget.style.background='var(--orange-dim)');}}
              onMouseLeave={e=>{(e.currentTarget.style.borderColor='var(--gray-200)');(e.currentTarget.style.color='var(--gray-500)');(e.currentTarget.style.background='none');}}>
              <Plus size={14}/> Add Question Type
            </button>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:20, marginTop:14, paddingTop:12, borderTop:'1px solid var(--gray-100)', fontSize:13 }}>
              <span style={{ color:'var(--gray-500)' }}>Total Questions : <strong style={{ color:'var(--black)' }}>{totalQ}</strong></span>
              <span style={{ color:'var(--gray-500)' }}>Total Marks : <strong style={{ color:'var(--black)' }}>{totalM}</strong></span>
            </div>
          </div>

          {/* Additional info */}
          <div className="card fade-up" style={{ padding:'20px 22px', marginBottom:22 }}>
            <label style={{ fontSize:13, fontWeight:600, color:'var(--black)', display:'block', marginBottom:10 }}>
              Additional Information <span style={{ fontWeight:400, color:'var(--gray-400)' }}>[For better output]</span>
            </label>
            <textarea className="input" style={{ minHeight:80 }}
              placeholder="e.g. Generate a question paper for a 3 hour exam duration, focus on chapters 3-5..."
              value={additionalInfo} onChange={e=>setAdditionalInfo(e.target.value)}/>
          </div>

          <div className="fade-up" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <button className="btn btn-ghost" onClick={()=>router.push('/assignments')}>Previous</button>
            <button className="btn btn-orange" onClick={handleSubmit} disabled={submitting} style={{ minWidth:130 }}>
              {submitting?<><Loader2 size={14} className="spin"/> Generating...</>:'Next →'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
