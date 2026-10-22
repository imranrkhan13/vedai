'use client';
import '../classroom.css';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/ui/Topbar';
import { api } from '@/lib/api';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { markErrors, hasUnsavedMarks, fillEmptySuggestions } from '@/lib/marksReview';
import { ArrowLeft } from 'lucide-react';

type Row = { id: string; studentId: string; name: string; submitted: boolean; submittedAt: string | null; late: boolean; released: boolean; markedTotal: number | null; ageGroup?: string; aiConsent?: boolean };

export default function StudentsPage() {
  const [confirm, confirmNode] = useConfirm();
  const router = useRouter();
  const reviewRef=useRef<HTMLDivElement>(null);
  const [aid, setAid] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [max, setMax] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sid, setSid] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ studentId: string; code: string } | null>(null);
  const [open, setOpen] = useState<string>('');
  const [detail, setDetail] = useState<any>(null);
  const [mk, setMk] = useState<Record<string, { marks: string; reason: string }>>({});

  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const [saveFeedback,setSaveFeedback]=useState('');
  const load = (a: string) => api.rosterList(a).then(r => { setRows(r.students); setMax(r.totalMarks); }).catch(e => toast.error(e instanceof Error ? e.message : 'Could not load')).finally(() => setLoading(false));
  useEffect(() => { const a = new URLSearchParams(window.location.search).get('a') || ''; setAid(a); if (a) load(a); else setLoading(false); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true);
    try { const r = await api.rosterAdd(aid, sid.trim(), name.trim()); setFresh({ studentId: r.studentId, code: r.accessCode }); setSid(''); setName(''); await load(aid); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Could not add'); }
    finally { setBusy(false); }
  };
  const reset = async (r: Row) => {
    if (!(await confirm(`Make a new access code for ${r.studentId}? The old code and any open session stop working.`, 'Make new code'))) return;
    try { const x = await api.rosterReset(aid, r.id); setFresh({ studentId: r.studentId, code: x.accessCode }); } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };
  const remove = async (r: Row) => {
    if (!(await confirm(`Remove ${r.studentId} and any submission they made? This cannot be undone.`, 'Remove'))) return;
    try { await api.rosterRemove(aid, r.id); if (fresh?.studentId === r.studentId) setFresh(null); if (open === r.id) { setOpen(''); setDetail(null); } await load(aid); } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };
  const view = async (r: Row) => {
    setOpen(r.id); setDetail(null);setFieldErrors({});setSaveFeedback('');
    try {
      const d = await api.rosterSubmission(aid, r.id); setDetail(d);
      const m: Record<string, { marks: string; reason: string }> = {};
      for (const q of d.questions) { const x = d.marks[q.id]; m[q.id] = { marks: x ? String(x.marks) : '', reason: x?.reason || '' }; }
      setMk(m);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };
  useEffect(()=>{ if(detail) reviewRef.current?.scrollIntoView({behavior:'smooth',block:'start'}); },[detail?.student?.id]);
  const useSuggestions = () => {
    const {next,added}=fillEmptySuggestions(mk,detail.aiDrafts || {});
    setMk(next);setSaveFeedback(added ? `${added} suggestions added to empty fields. Review and save them. Existing entries were kept.` : 'No suggestions added. Existing entries and drafts needing review were kept.');
  };
  const saveAll = async () => {
    if (busy) return;
    const errors=markErrors(detail.questions,mk);setFieldErrors(errors);
    if(Object.keys(errors).length){const message=`Enter marks for ${Object.keys(errors).length} missing or invalid question(s), then save again. Use 0 where no marks are awarded.`;setSaveFeedback(message);toast.error(message);document.getElementById(`mark-${Object.keys(errors)[0]}`)?.focus();return;}
    setBusy(true);setSaveFeedback('Saving marks…');
    try { for (const q of detail.questions) await api.rosterMark(aid,open,q.id,Number(mk[q.id].marks),mk[q.id].reason); setDetail(await api.rosterSubmission(aid,open)); await load(aid); setSaveFeedback('All marks saved. You can now share results.');toast.success('All marks saved.'); }
    catch(e) {const message=e instanceof Error ? e.message : 'Could not save all marks';setSaveFeedback(`Save failed: ${message}. Some earlier questions may have saved. Your entries are kept; retry before sharing.`);toast.error(message);setDetail(await api.rosterSubmission(aid,open).catch(()=>detail));}
    finally { setBusy(false); }
  };
  const displayAnswer = (q:any) => {
    const answer=detail.answers[q.id] || '';
    if (!q.options?.length || !answer) return answer || 'No answer submitted';
    const token=answer.match(/^option:(\d+)$/), letter=answer.match(/^\(?([a-z])\)?[.)]?$/i);
    const index=token?Number(token[1]):letter?letter[1].toLowerCase().charCodeAt(0)-97:q.options.indexOf(answer);
    return q.options[index] ? `${String.fromCharCode(65+index)}. ${q.options[index]}` : answer;
  };
  const saveMark = async (q: any) => {
    const v = mk[q.id]; const n = Number(v.marks);
    if (v.marks === '' || !Number.isInteger(n) || n < 0 || n > q.marks) { toast.error(`Marks must be a whole number from 0 to ${q.marks}`); return; }
    try { await api.rosterMark(aid, open, q.id, n, v.reason); toast.success('Marks saved'); const d = await api.rosterSubmission(aid, open); setDetail(d); await load(aid); } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };
  const release = async (released: boolean) => {
    if(released && hasUnsavedMarks(detail.questions,mk,detail.marks)){setFieldErrors(markErrors(detail.questions,mk));setSaveFeedback('Save marks for every question and save your latest changes before sharing.');toast.error('Save all marks before sharing.');return;}
    try { await api.rosterRelease(aid, open, released); toast.success(released ? 'Marks shared with the student' : 'Marks hidden from the student'); setDetail({ ...detail, released }); await load(aid); } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };

  return (
    <div className="classroom" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {confirmNode}
      <Sidebar />
      <main className="main-content" style={{ marginLeft: 248, flex: 1, minWidth: 0 }}>
        <Topbar>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push(aid ? `/output/${aid}` : '/assignments')} style={{ gap: 6 }}><ArrowLeft size={14} /> Back</button>
        </Topbar>
        <div style={{ padding: '28px 24px 60px', maxWidth: 1000 }}>
          <p className="eyebrow">Teacher workspace</p><h1 className="hero-title">Your classroom, at a glance.</h1>
          <p className="muted">Add students, review their answers, and share results when you’re ready.</p>
          <div className="summary-grid"><div><strong>{rows.length}</strong><span>Students assigned</span></div><div><strong>{rows.filter(r=>r.submitted).length}</strong><span>Answers submitted</span></div><div><strong>{rows.filter(r=>r.released).length}</strong><span>Results shared</span></div></div>
          {!aid && !loading && <p style={{ fontSize: 13 }}>Open this page from an assignment.</p>}
          {aid && (
            <form onSubmit={add} className="card" style={{ padding: '14px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
              <div style={{ flex: '1 1 140px' }}><label htmlFor="roster-id" style={{ fontSize: 12, fontWeight: 600 }}>Student ID</label><input id="roster-id" className="input" required value={sid} onChange={e => setSid(e.target.value)} placeholder="e.g. 7B-014" style={{ marginTop: 4 }} /></div>
              <div style={{ flex: '1 1 140px' }}><label htmlFor="roster-name" style={{ fontSize: 12, fontWeight: 600 }}>Name (optional)</label><input id="roster-name" className="input" value={name} onChange={e => setName(e.target.value)} maxLength={60} style={{ marginTop: 4 }} /></div>
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Adding...' : 'Add student'}</button>
            </form>
          )}
          {fresh && (
            <div className="card" style={{ padding: '14px 20px', marginBottom: 14, borderColor: 'var(--orange-border)', background: 'var(--orange-dim)' }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Access code for {fresh.studentId}: <span style={{ fontFamily: 'monospace', fontSize: 15 }}>{fresh.code}</span></p>
              <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>This is shown once and cannot be looked up later. Give it to the student privately. If lost, make a new code.</p>
              <button className="btn btn-ghost btn-sm" onClick={() => setFresh(null)} style={{ marginTop: 8 }}>Done</button>
            </div>
          )}
          {loading && <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Loading...</p>}
          {aid && !loading && rows.length === 0 && <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>No students yet.</p>}
          {rows.map(r => (
            <div key={r.id} className="card" style={{ padding: '12px 20px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{r.studentId}{r.name ? ` (${r.name})` : ''}</p>
                <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>{r.submitted ? `Submitted ${new Date(r.submittedAt as string).toLocaleString()}${r.late ? ', late' : ''}${r.markedTotal !== null ? ` - marked ${r.markedTotal}/${max}` : ''}${r.released ? ' - shared' : ''}` : 'Not submitted'}</p>
              </div>
              {r.submitted && <button className="btn btn-orange btn-sm" onClick={() => view(r)}>Review</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => reset(r)}>New code</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(r)}>Remove</button>
            </div>
          ))}
          {open && !detail && <p role="status" className="muted">Opening submission…</p>}
          {open && detail && (
            <div ref={reviewRef} className="card" style={{ padding: '24px', marginTop: 24, scrollMarginTop:20 }}>
              <p className="eyebrow">Submission review</p><h2 style={{fontSize:24,letterSpacing:"-.03em",margin:"6px 0"}}>{detail.student.name || detail.student.studentId}</h2><p className="muted">MCQs use the answer key. Written responses are checked against marking criteria.</p><div className="review-tools"><button className="btn btn-ghost btn-sm" onClick={useSuggestions}>Use confident suggestions</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={saveAll}>{busy ? 'Saving…' : 'Save all marks'}</button></div>
              {saveFeedback && <p role="status" aria-live="polite" style={{margin:"12px 0",fontSize:13,fontWeight:600}}>{saveFeedback}</p>}
              <button className="btn btn-ghost btn-sm" onClick={() => view({ id: open } as Row)}>Refresh review</button>
              {detail.gradingError && <p role="status" style={{ color: '#b45309', fontSize: 12 }}>{detail.gradingError}</p>}
              <button className="btn btn-ghost btn-sm" disabled={busy} style={{ margin: '10px 0' }} onClick={async () => { setBusy(true); try { await api.rosterGrade(aid, open); await view({ id: open } as Row); toast.success('Grading queued. Refresh the review shortly.'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Grading failed'); } finally { setBusy(false); } }}>{busy ? 'Grading…' : 'Generate / retry AI grading'}</button>

              <p style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 12 }}>You decide the marks. The marking guide and answer key are AI drafts for your reference only. Marks are hidden from the student until you share them.</p>
              {detail.questions.map((q: any, qi: number) => (
                <div key={q.id} style={{ borderTop: qi ? '1px solid var(--border)' : 'none', paddingTop: qi ? 12 : 0, marginTop: qi ? 12 : 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{q.number}. {q.text} <span style={{ color: 'var(--gray-500)', fontWeight: 500 }}>[max {q.marks}]</span></p>
                  <p className="eyebrow" style={{marginTop:12}}>Student answer</p><p className="student-answer">{displayAnswer(q)}</p>
                  {detail.aiDrafts?.[q.id] && (() => { const dr=detail.aiDrafts[q.id]; return <div className="grade-suggestion">
                    <div className="question-top" style={{marginBottom:6}}><b style={{fontSize:18}}>{dr.marks} / {q.marks}</b><span className="status-pill">{dr.gradingMethod==='local-blank' ? 'No answer · local check' : dr.gradingMethod==='exact' ? 'Answer key checked' : 'Needs your review'}</span></div>
                    <p className="muted">{['exact','local-blank'].includes(dr.gradingMethod) ? dr.reason : `${dr.covered?.length || 0} criteria met${dr.partial?.length ? ` · ${dr.partial.length} partly met` : ''}${dr.uncertain?.length ? ` · ${dr.uncertain.length} need review` : ''}. Review the evidence before saving.`}</p>
                    <details><summary>Why these marks?</summary>{dr.evidence?.length ? <ul style={{paddingLeft:18,fontSize:13,lineHeight:1.8,marginTop:10}}>{dr.evidence.map((point:any,index:number)=><li key={index}><b>{point.awarded} / {point.marks}</b> — {point.text} ({point.status}{point.needsReview ? ', check this point' : ''})</li>)}</ul> : <p style={{fontSize:13,marginTop:8}}>{dr.reason}</p>}<p className="muted" style={{fontSize:11,marginTop:8}}>{dr.explanationSource} · {dr.model}</p></details>
                    <button className="btn btn-ghost btn-sm" style={{marginTop:12}} disabled={!!mk[q.id]?.marks?.trim() || !!mk[q.id]?.reason?.trim()} onClick={()=>{setMk({...mk,[q.id]:{marks:String(dr.marks),reason:dr.reason}});setSaveFeedback('Suggestion added. Review and save it.');}}>Use this suggestion</button>
                  </div>; })()}
                  {detail.preview?.[q.id] && <p style={{ fontSize: 12, margin: '6px 0', padding: '6px 8px', background: 'var(--gray-50)', borderRadius: 6 }}><b>{detail.released ? 'What the student sees now' : 'What the student will see once you share'} ({detail.student.ageGroup === 'adult' ? '18 or over wording' : detail.student.ageGroup === 'under18' ? 'under 18 wording' : 'age group not set, simple wording'}), from your saved marks:</b> {detail.preview[q.id].text}</p>}
                  <details style={{margin:"12px 0"}}><summary className="muted" style={{cursor:"pointer"}}>Reference answer & marking guide</summary>
                  {q.answer && <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>Answer key (AI draft): {q.answer}</p>}
                  {q.rubric?.length === 3 && <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>Levels (AI draft): {q.rubric.map((l: any) => `${l.marks}: ${l.descriptor}`).join(' | ')}</p>}
                  </details>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <input id={`mark-${q.id}`} aria-invalid={!!fieldErrors[q.id]} aria-describedby={fieldErrors[q.id]?`mark-error-${q.id}`:undefined} className="input" disabled={busy} type="number" min={0} max={q.marks} value={mk[q.id]?.marks ?? ''} onChange={e => setMk({ ...mk, [q.id]: { ...mk[q.id], marks: e.target.value } })} style={{ width: 70, height: 34, fontSize: 13, borderColor:fieldErrors[q.id]?'#b42318':undefined }} aria-label={`Marks for question ${q.number}`} />
                    <input disabled={busy} className="input" value={mk[q.id]?.reason ?? ''} maxLength={2000} placeholder="Explain the awarded marks" onChange={e => setMk({ ...mk, [q.id]: { ...mk[q.id], reason: e.target.value } })} style={{ flex: '1 1 200px', height: 34, fontSize: 13 }} aria-label={`Comment for question ${q.number}`} />
                    <button disabled={busy} className="btn btn-orange btn-sm" onClick={() => saveMark(q)}>Save marks</button>
                  </div>
                  {fieldErrors[q.id] && <p id={`mark-error-${q.id}`} role="alert" style={{color:"#b42318",fontSize:12,marginTop:6}}>{fieldErrors[q.id]}</p>}
                </div>
              ))}
              <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => release(!detail.released)}>{detail.released ? 'Hide marks from student' : 'Share marks with student'}</button>
                <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{detail.released ? 'The student can see marks and comments.' : 'The student cannot see marks yet.'}</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
