'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/ui/Topbar';
import { useAssignmentStore } from '@/store/assignmentStore';
import { readTextSource, normalizeSource, sourceProblem, MAX_SOURCE_CHARACTERS } from '@/lib/sourceText';
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
  const [versions, setVersions] = useState(1);
  const [batch, setBatch] = useState<{n:number;id?:string;state:string;note?:string}[]>([]);
  const [batchWarn, setBatchWarn] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [sourceStatus, setSourceStatus] = useState<'idle'|'reading'|'ready'|'error'>('idle');
  const [sourceError, setSourceError] = useState('');
  const readRequest = useRef(0);
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

  const readPdfText = async (file:File) => {
    // pdf.js is loaded in the browser from a pinned CDN version (no server cost, no extra dependency to bundle).
    const base = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/';
    let pdfjs: any;
    try { pdfjs = await import(/* webpackIgnore: true */ base + 'pdf.min.mjs'); }
    catch { throw new Error('PDF_LOADER'); }
    pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let out = '';
    try {
    for(let p=1; p<=doc.numPages; p++){
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      out += tc.items.map((it:any)=>it.str).join(' ') + '\n';
      if(out.length>MAX_SOURCE_CHARACTERS) throw new Error('Source notes exceed 100,000 characters. Split the PDF into smaller documents.');
    }
    return normalizeSource(out);
    } finally { await doc.destroy(); }
  };

  const readImageText = async (file:File) => {
    // Text is read inside the browser with Tesseract (loaded from a pinned CDN version). The image is not uploaded to our server.
    let T: any;
    const url = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js';
    try { T = await import(/* webpackIgnore: true */ url); }
    catch { throw new Error('OCR_LOADER'); }
    const worker = await (T.createWorker || T.default.createWorker)('eng');
    try {
      const r = await worker.recognize(file);
      return String(r.data.text||'').replace(/\0/g,'').trim();
    } finally { await worker.terminate(); }
  };

  const readFile = async (file:File) => {
    const request = ++readRequest.current;
    setFileName(file.name); setFileContent(''); setSourceError(''); setSourceStatus('reading');
    setErrors(previous=>({...previous,source:''}));
    const isPdf=/\.pdf$/i.test(file.name), isImg=/\.(png|jpe?g|webp)$/i.test(file.name) || /^image\/(png|jpeg|webp)$/.test(file.type);
    try {
      if(!isPdf && !isImg && !/\.txt$/i.test(file.name)) throw new Error('Supported files: TXT, text-based PDF, or PNG/JPG/WebP.');
      if(file.size>10*1024*1024) throw new Error('File exceeds 10 MB. Choose a smaller document.');
      const text=normalizeSource(isPdf ? await readPdfText(file) : isImg ? await readImageText(file) : await readTextSource(file));
      if(request!==readRequest.current) return;
      const problem=sourceProblem(text);
      if(problem) throw new Error(isPdf && !text ? 'This PDF has no selectable text. Paste the notes below or upload a clear image.' : problem);
      setFileContent(text); setSourceStatus('ready');
      toast.success(`${text.length.toLocaleString()} characters read. Review the source below.`);
    } catch(err) {
      if(request!==readRequest.current) return;
      const message=err instanceof Error ? err.message : 'Could not read this source.';
      const friendly=/^(PDF_LOADER|OCR_LOADER)$/.test(message) ? 'The document reader could not load. Check your connection, try a TXT file, or paste your notes below.' : message;
      setFileContent('');setSourceStatus('error');setSourceError(friendly);toast.error(friendly);
    }
  };
  const clearSource = () => { ++readRequest.current;setFileName('');setFileContent('');setSourceError('');setSourceStatus('idle');if(fileRef.current) fileRef.current.value=''; };

  const validate = () => {
    const e:Record<string,string> = {};
    if(sourceStatus==='reading') e.source='Wait for the source to finish reading.';
    else { const problem=sourceProblem(fileContent);if(problem) e.source=problem; }
    if(!subject.trim()) e.subject='Required';
    if(!dueDate) e.dueDate='Required';
    if(qRows.length===0) e.qRows='Add at least one question type';
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const qwords = (t:string)=> new Set((t.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>2));
  const sim = (x:string,y:string)=>{ const A=qwords(x),B=qwords(y); let n=0; A.forEach(w=>{ if(B.has(w)) n++; }); return n/((A.size+B.size-n)||1); };
  const questionsOf = (a:any):string[] => ((a?.output?.sections||[]) as any[]).flatMap((sec:any)=>(sec.questions||[]).map((q:any)=>String(q.text||'')));
  const sleep = (ms:number)=> new Promise(r=>setTimeout(r,ms));

  const handleSubmit = async () => {
    if(!validate()){ toast.error('Please fix the errors'); return; }
    setSubmitting(true); setBatchWarn([]);
    const base = {
      subject, dueDate,
      questionTypes: qRows.map(r=>r.type),
      questionPlan: qRows.map(r=>({ type:r.type, qty:r.qty, marks:r.marks })),
      numberOfQuestions: totalQ, totalMarks: totalM,
      difficulty: 'mixed' as const,
      fileContent: normalizeSource(fileContent),
      clientId: clientId||undefined,
    };
    const baseTitle = title.trim()||`${subject} Assessment`;
    if(versions<=1){
      try {
        const result = await api.createAssignment({ ...base, title: baseTitle, additionalInstructions: additionalInfo||undefined });
        toast.success('Generating question paper...');
        router.push(`/output/${result.id}`);
      } catch(err:unknown){
        toast.error(err instanceof Error?err.message:'Failed');
      } finally { setSubmitting(false); }
      return;
    }
    // Several versions: one at a time. Stop at the first failure and keep finished versions.
    const rows:{n:number;id?:string;state:string;note?:string}[] = Array.from({length:versions},(_,i)=>({n:i+1,state:'waiting'}));
    setBatch([...rows]);
    const texts:string[][] = [];
    try {
      for(let k=0;k<versions;k++){
        rows[k]={n:k+1,state:'generating'}; setBatch([...rows]);
        const extra = `This is version ${k+1} of ${versions} of the same paper. Other versions are generated separately, so choose a different selection of facts, wording and numbers from the other versions. For this version, start with the ${k+1===1?'first':k+1===2?'second':k+1===3?'third':`#${k+1}`} part of the material.`;
        let id='';
        try {
          const r = await api.createAssignment({ ...base, title:`${baseTitle} - Version ${k+1}`, additionalInstructions: [additionalInfo, extra].filter(Boolean).join('\n'), clientId: undefined });
          id = r.id;
        } catch(err:unknown){
          rows[k]={n:k+1,state:'stopped',note:err instanceof Error?err.message:'Could not start'}; setBatch([...rows]); break;
        }
        rows[k]={n:k+1,id,state:'generating'}; setBatch([...rows]);
        let done:any=null;
        for(let t=0;t<90;t++){
          await sleep(5000);
          try { const a:any = await api.getAssignment(id); if(a.status==='completed'||a.status==='failed'){ done=a; break; } } catch { /* keep waiting */ }
        }
        if(!done || done.status!=='completed'){
          rows[k]={n:k+1,id,state:'stopped',note: done?'Generation failed (the free AI models may be busy or rate limited). Finished versions are kept.':'Still running after 7 minutes; check My Assignments later.'}; setBatch([...rows]); break;
        }
        texts.push(questionsOf(done));
        rows[k]={n:k+1,id,state:'done'}; setBatch([...rows]);
      }
      const warns:string[]=[];
      for(let i=0;i<texts.length;i++) for(let j=i+1;j<texts.length;j++){
        const dup = texts[j].filter(q=>texts[i].some(p=>sim(p,q)>=0.6)).length;
        if(dup>0) warns.push(`Versions ${i+1} and ${j+1} share ${dup} very similar question${dup>1?'s':''} (wording check only).`);
      }
      setBatchWarn(warns);
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

            <input ref={fileRef} type="file" accept=".txt,.pdf,.png,.jpg,.jpeg,.webp,text/plain,application/pdf,image/png,image/jpeg,image/webp" style={{ display:'none' }} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file) void readFile(file);}}/>
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
                <p style={{ fontSize:11, color:'var(--gray-400)', marginBottom:12 }}>TXT, text-based PDF, or a clear printed image (PNG/JPG/WebP), up to 10MB</p>
                <button className="btn btn-ghost btn-sm" type="button" onClick={e=>{e.stopPropagation();fileRef.current?.click();}}>Browse Files</button>
              </div>
            ):(
              <><div className="fade-in" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--orange-dim)', borderRadius:8, border:'1px solid var(--orange-border)', marginBottom:16 }}>
                <span style={{ fontSize:18 }}>📄</span>
                <span style={{ flex:1, fontSize:13, fontWeight:500, color:'var(--black)' }}>{fileName}</span>
                <button onClick={clearSource} aria-label="Remove source file" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', padding:4, borderRadius:5, display:'flex', transition:'color 0.12s' }}
                  onMouseEnter={e=>(e.currentTarget.style.color='#EF4444')}
                  onMouseLeave={e=>(e.currentTarget.style.color='var(--gray-400)')}>
                  <X size={14}/>
                </button>
              </div>
                <p role="status" style={{fontSize:12,color:'var(--gray-500)',margin:'-8px 0 14px'}}>{sourceStatus==='reading' ? 'Reading source… Generation is blocked until reading finishes.' : `${fileContent.length.toLocaleString()} characters read.`}</p>
              </>
            )}

            <label htmlFor="source-notes" style={{display:'block',fontSize:13,fontWeight:600,marginBottom:6}}>Source notes · review extracted text or paste your own</label>
            <textarea id="source-notes" className="input" value={fileContent} disabled={sourceStatus==='reading'||submitting} onChange={e=>{const text=e.target.value;setFileContent(text);setSourceError('');setErrors(previous=>({...previous,source:''}));setSourceStatus(sourceProblem(text)?'error':'ready');}} placeholder="Paste your syllabus or teaching notes here. Include the grade or class when relevant." aria-describedby="source-status" style={{minHeight:150,marginBottom:8,fontSize:13,lineHeight:1.6}} />
            <p id="source-status" role={(sourceStatus==='error'||sourceError||errors.source)?'alert':'status'} style={{fontSize:12,lineHeight:1.6,marginBottom:14,color:sourceProblem(fileContent)?'#a13f28':'#315846'}}>{sourceStatus==='reading' ? 'Reading source…' : sourceError || errors.source || sourceProblem(fileContent) || `${fileContent.length.toLocaleString()} characters ready. Generation will use this text; check that it matches your notes.`}</p>
            <p style={{fontSize:11,color:'var(--gray-500)',marginBottom:18}}>Maximum 100,000 characters. Images are read in your browser. Extracted or pasted notes are sent to the generation provider; do not include private student information.</p>
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
            <div className="qgrid qhead" style={{ display:'grid', gap:8, marginBottom:10, padding:'0 4px' }}>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--gray-500)' }}>Question Type</span>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--gray-500)', textAlign:'center' }}>No. of Questions</span>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--gray-500)', textAlign:'center' }}>Marks</span>
              <span/>
            </div>
            {errors.qRows&&<p style={{ color:'var(--red)', fontSize:12, marginBottom:8 }}>{errors.qRows}</p>}
            <div className="stagger">
              {qRows.map((row,i)=>(
                <div key={i} className="fade-up qgrid" style={{ display:'grid', gap:8, marginBottom:8, alignItems:'center' }}>
                  <select className="input qsel" value={row.type} onChange={e=>updateRow(i,'type',e.target.value)} style={{ height:36, fontSize:13, padding:'0 28px 0 10px' }}>
                    {Q_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                  <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:6 }}>
                    <span className="mlabel">Questions</span>
                    <Stepper value={row.qty} onChange={v=>updateRow(i,'qty',v)}/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:6 }}>
                    <span className="mlabel">Marks</span>
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

          <div className="card fade-up" style={{ padding:'16px 22px', marginBottom:22 }}>
            <label style={{ fontSize:13, fontWeight:600, color:'var(--black)', display:'block', marginBottom:8 }}>Paper versions</label>
            <select className="input" value={versions} onChange={e=>setVersions(Number(e.target.value))} disabled={submitting} style={{ height:36, fontSize:13, maxWidth:120 }}>
              {Array.from({length:10},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}
            </select>
            <p style={{ fontSize:11, color:'var(--gray-500)', marginTop:8, lineHeight:1.5 }}>Up to 10. Versions are made one at a time from the same notes. This app allows 10 paper generations per hour (its own limit). The free AI models can still be slow or fail. If one fails, the batch stops and finished versions are kept. Different wording is requested, not guaranteed; similar questions between versions are flagged below.</p>
            {batch.length>0&&(
              <div style={{ marginTop:12, fontSize:13, display:'flex', flexDirection:'column', gap:6 }}>
                {batch.map(r=>(
                  <div key={r.n} style={{ display:'flex', gap:8, alignItems:'baseline', flexWrap:'wrap' }}>
                    <span style={{ fontWeight:600 }}>Version {r.n}:</span>
                    <span style={{ color:r.state==='stopped'?'#DC2626':'var(--gray-700)' }}>{r.state==='done'?'ready':r.state==='generating'?'generating...':r.state==='waiting'?'waiting':'stopped'}</span>
                    {r.id&&r.state==='done'&&<a href={`/output/${r.id}`} style={{ color:'var(--orange)', fontWeight:600 }}>Open</a>}
                    {r.note&&<span style={{ fontSize:11, color:'var(--gray-500)' }}>{r.note}</span>}
                  </div>
                ))}
                {batchWarn.map((w,i)=>(<p key={i} style={{ fontSize:12, color:'#B45309' }}>{w}</p>))}
              </div>
            )}
          </div>

          <div className="fade-up" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <button className="btn btn-ghost" onClick={()=>router.push('/assignments')}>Previous</button>
            <button className="btn btn-orange" onClick={handleSubmit} disabled={submitting || sourceStatus==='reading' || !!sourceProblem(fileContent)} style={{ minWidth:130 }}>
              {submitting?<><Loader2 size={14} className="spin"/> Generating...</>:(versions>1?`Generate ${versions} papers →`:'Generate paper →')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
                                                                                                                             }
