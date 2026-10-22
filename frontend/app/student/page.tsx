'use client';
import '../classroom.css';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface SQ { id: string; number: number; text: string; marks: number; type: string; options: string[] }

export default function StudentPage() {
  const [confirm, confirmNode] = useConfirm();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sid, setSid] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [ans, setAns] = useState<Record<string, string>>({});

  const load = () => api.studentMe().then(setMe).catch(() => setMe(null)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try { await api.studentLogin(sid, code); setLoading(true); await load(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Could not sign in'); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (busy) return;
    const remaining = me.assignment.questions.filter((q: SQ) => !ans[q.id]?.trim()).length;
    if (!(await confirm(`${remaining ? `${remaining} question${remaining === 1 ? ' is' : 's are'} unanswered and will receive zero marks. ` : ''}Submit your answers? You cannot change them afterwards.`, 'Submit answers'))) return;
    setBusy(true);
    try { await api.studentSubmit(ans); toast.success('Submitted'); await load(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Could not submit'); }
    finally { setBusy(false); }
  };
  const logout = async () => { try { await api.studentLogout(); } catch {} setMe(null); setAns({}); };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Loading...</div>;

  if (!me) return (
    <div className="classroom" style={{ minHeight: '100vh', background:'#f5f7f2', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={login} className="card" style={{ width: '100%', maxWidth: 380, padding: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Ques-AI</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>Student sign in. Use the student ID and access code your teacher gave you.</p>
        <label htmlFor="student-id" style={{ fontSize: 12, fontWeight: 600 }}>Student ID</label>
        <input id="student-id" className="input" required autoComplete="username" value={sid} onChange={e => setSid(e.target.value)} style={{ marginBottom: 12, marginTop: 4 }} />
        <label htmlFor="student-code" style={{ fontSize: 12, fontWeight: 600 }}>Access code</label>
        <input id="student-code" className="input" type="password" required autoComplete="current-password" value={code} onChange={e => setCode(e.target.value)} placeholder="Your teacher’s private code" style={{ marginTop: 4 }} />
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 18, justifyContent: 'center' }}>{busy ? 'Please wait...' : 'Sign in'}</button>
        <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 14, lineHeight: 1.5 }}>MCQs are checked against the answer key. Written answers are sent to Jev for suggested marks and feedback. Your teacher reviews and shares the final results.</p>
      </form>
    </div>
  );

  const a = me.assignment; const sub = me.submission; const qs: SQ[] = a.questions;
  const submitted = !!sub.submitted;
  const answered = qs.filter(q => (submitted ? sub.answers[q.id] : ans[q.id])?.trim()).length;
  const selected = (q: SQ, index: number) => { const value = submitted ? sub.answers[q.id] : ans[q.id]; return value === `option:${index}` || value?.toLowerCase() === String.fromCharCode(97 + index) || value === q.options[index]; };
  const val = (q: SQ) => (submitted ? (sub.answers[q.id] || '') : (ans[q.id] || ''));
  return (
    <div className="classroom" style={{ minHeight: '100vh', background: '#f5f7f2', padding: '28px 16px 60px' }}>
      {confirmNode}
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Ques-AI</span>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Student {me.student.studentId}{me.student.name ? ` (${me.student.name})` : ''} <button className="btn btn-ghost btn-sm" onClick={logout} style={{ marginLeft: 8 }}>Sign out</button></span>
        </div>
        <div className="card" style={{ padding: '18px 20px', marginBottom: 14 }}>
          <p className="eyebrow">Your assessment</p><h1 className="hero-title">{a.title}</h1>
          <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>{a.subject} - {a.totalMarks} marks - due {new Date(a.dueDate).toLocaleDateString()}</p>
          {!submitted && <><div className="progress-track" role="progressbar" aria-label="Questions answered" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={qs.length}><div style={{width:`${qs.length ? answered / qs.length * 100 : 0}%`}} /></div><p className="muted">{answered} of {qs.length} answered · Choose one option for MCQs. Explain your reasoning for written questions.</p></>}
          {submitted && <p style={{ fontSize: 12, marginTop: 8 }}><span className="badge badge-green">Submitted</span> {new Date(sub.submittedAt).toLocaleString()}{sub.late ? ' (after the due date)' : ''}</p>}
          {submitted && sub.marks && <p style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>Your teacher marked this: {sub.total} / {a.totalMarks}</p>}
          {submitted && !sub.marks && <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>Your teacher has not shared marks yet.</p>}
        </div>
        {qs.map(q => (
          <div key={q.id} className="card question-card">
            <div className="question-top"><span className="eyebrow">Question {q.number} · {q.options.length ? 'Multiple choice' : q.type}</span><span className="status-pill">{q.marks} mark{q.marks === 1 ? '' : 's'}</span></div>
            <p id={`question-${q.id}`} className="question-title">{q.text}</p>
            {q.options.length > 0 ? <fieldset style={{border:0}} aria-labelledby={`question-${q.id}`}>
              <legend className="muted">{submitted ? 'Your selected answer' : 'Choose one answer'}</legend>
              {q.options.map((option,index)=><label className="choice" key={index}>
                <input type="radio" name={q.id} disabled={submitted} checked={selected(q,index)} onChange={()=>setAns({...ans,[q.id]:`option:${index}`})} aria-label={`${String.fromCharCode(65+index)}. ${option}`} />
                <span className="choice-letter" aria-hidden="true">{String.fromCharCode(65+index)}</span><span>{option}</span>
              </label>)}
            </fieldset> : <><textarea className="input" value={val(q)} readOnly={submitted} onChange={e=>setAns({...ans,[q.id]:e.target.value})} maxLength={5000} placeholder="Write your answer here. Include the key ideas and show any working." style={{minHeight:/long|essay|descriptive/i.test(q.type)?220:140,fontSize:14,lineHeight:1.8,marginTop:6,padding:16}} aria-label={`Answer to question ${q.number}`} />
              {!submitted && <div className="answer-footer"><span>Use your own words. Clear reasoning earns credit.</span><span>{val(q).length.toLocaleString()} / 5,000</span></div>}</>}
            {sub.feedback && sub.feedback[q.id] && <p style={{ fontSize: 12, marginTop: 6, color: 'var(--gray-500)' }}>{sub.feedback[q.id].text}</p>}
            {sub.marks && sub.marks[q.id] && (
              <p style={{ fontSize: 12, marginTop: 8 }}><b>Marks: {sub.marks[q.id].marks} / {q.marks}</b>{sub.marks[q.id].reason ? ` - ${sub.marks[q.id].reason}` : ''}</p>
            )}
          </div>
        ))}
        {!submitted && (
          <div className="submit-bar">
            <div><b style={{fontSize:14}}>{answered} / {qs.length} answered</b><p className="muted">Check your work before submitting. Your teacher reviews the marks.</p></div>
            <button className="btn btn-primary" onClick={submit} disabled={busy} style={{flexShrink:0}}>{busy ? 'Submitting…' : 'Submit answers →'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
