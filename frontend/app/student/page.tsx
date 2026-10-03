'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

interface SQ { id: string; number: number; text: string; marks: number; type: string; options: string[] }

export default function StudentPage() {
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
    if (!window.confirm('Submit your answers? You cannot change them after this.')) return;
    setBusy(true);
    try { await api.studentSubmit(ans); toast.success('Submitted'); await load(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Could not submit'); }
    finally { setBusy(false); }
  };
  const logout = async () => { try { await api.studentLogout(); } catch {} setMe(null); setAns({}); };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Loading...</div>;

  if (!me) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={login} className="card" style={{ width: '100%', maxWidth: 380, padding: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Ques-AI</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>Student sign in. Use the student ID and access code your teacher gave you.</p>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Student ID</label>
        <input className="input" required autoComplete="off" value={sid} onChange={e => setSid(e.target.value)} style={{ marginBottom: 12, marginTop: 4 }} />
        <label style={{ fontSize: 12, fontWeight: 600 }}>Access code</label>
        <input className="input" required autoComplete="off" value={code} onChange={e => setCode(e.target.value)} placeholder="XXXXX-XXXXX" style={{ marginTop: 4 }} />
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 18, justifyContent: 'center' }}>{busy ? 'Please wait...' : 'Sign in'}</button>
        <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 14, lineHeight: 1.5 }}>Your answers are saved for your teacher only. They are not sent to any AI service, except the built-in made-up demo answers on the one demo paper. Marks are given by your teacher.</p>
      </form>
    </div>
  );

  const a = me.assignment; const sub = me.submission; const qs: SQ[] = a.questions;
  const submitted = !!sub.submitted;
  const val = (q: SQ) => (submitted ? (sub.answers[q.id] || '') : (ans[q.id] || ''));
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '20px 16px 60px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Ques-AI</span>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Student {me.student.studentId}{me.student.name ? ` (${me.student.name})` : ''} <button className="btn btn-ghost btn-sm" onClick={logout} style={{ marginLeft: 8 }}>Sign out</button></span>
        </div>
        <div className="card" style={{ padding: '18px 20px', marginBottom: 14 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{a.title}</h1>
          <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>{a.subject} - {a.totalMarks} marks - due {new Date(a.dueDate).toLocaleDateString()}</p>
          {submitted && <p style={{ fontSize: 12, marginTop: 8 }}><span className="badge badge-green">Submitted</span> {new Date(sub.submittedAt).toLocaleString()}{sub.late ? ' (after the due date)' : ''}</p>}
          {submitted && sub.marks && <p style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>Your teacher marked this: {sub.total} / {a.totalMarks}</p>}
          {submitted && !sub.marks && <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>Your teacher has not shared marks yet.</p>}
        </div>
        {qs.map(q => (
          <div key={q.id} className="card" style={{ padding: '14px 20px', marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.6 }}>{q.number}. {q.text} <span style={{ color: 'var(--gray-500)', fontWeight: 500 }}>[{q.marks} mark{q.marks > 1 ? 's' : ''}]</span></p>
            {q.options.length > 0 && !submitted && (
              <div style={{ margin: '8px 0' }}>
                {q.options.map((o, i) => { const L = String.fromCharCode(97 + i); return (
                  <label key={i} style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 4, cursor: 'pointer' }}>
                    <input type="radio" name={q.id} checked={ans[q.id] === L} onChange={() => setAns({ ...ans, [q.id]: L })} /> ({L}) {o}
                  </label>); })}
              </div>
            )}
            {q.options.length > 0 && submitted && <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '6px 0' }}>{q.options.map((o, i) => `(${String.fromCharCode(97 + i)}) ${o}`).join('   ')}</p>}
            {(q.options.length === 0 || submitted) && (
              <textarea className="input" value={val(q)} readOnly={submitted} onChange={e => setAns({ ...ans, [q.id]: e.target.value })} maxLength={5000} placeholder={submitted ? '' : 'Type your answer'} style={{ minHeight: submitted ? 60 : 100, fontSize: 13, marginTop: 8 }} aria-label={`Answer to question ${q.number}`} />
            )}
            {sub.marks && sub.marks[q.id] && (
              <p style={{ fontSize: 12, marginTop: 8 }}><b>Marks: {sub.marks[q.id].marks} / {q.marks}</b>{sub.marks[q.id].reason ? ` - ${sub.marks[q.id].reason}` : ''}</p>
            )}
          </div>
        ))}
        {!submitted && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Submitting...' : 'Submit answers'}</button>
            <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>Typed answers only. You can submit once. Your answers go to your teacher, not to an AI service (except the built-in made-up demo answers on the one demo paper).</span>
          </div>
        )}
      </div>
    </div>
  );
}
