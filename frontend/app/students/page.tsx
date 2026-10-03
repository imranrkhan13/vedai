'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/ui/Topbar';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

type Row = { id: string; studentId: string; name: string; submitted: boolean; submittedAt: string | null; late: boolean; released: boolean; markedTotal: number | null; ageGroup?: string; aiConsent?: boolean };

export default function StudentsPage() {
  const router = useRouter();
  const [aid, setAid] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [max, setMax] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sid, setSid] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [age, setAge] = useState('unknown');
  const [fresh, setFresh] = useState<{ studentId: string; code: string } | null>(null);
  const [open, setOpen] = useState<string>('');
  const [detail, setDetail] = useState<any>(null);
  const [mk, setMk] = useState<Record<string, { marks: string; reason: string }>>({});

  const load = (a: string) => api.rosterList(a).then(r => { setRows(r.students); setMax(r.totalMarks); }).catch(e => toast.error(e instanceof Error ? e.message : 'Could not load')).finally(() => setLoading(false));
  useEffect(() => { const a = new URLSearchParams(window.location.search).get('a') || ''; setAid(a); if (a) load(a); else setLoading(false); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true);
    try { const r = await api.rosterAdd(aid, sid.trim(), name.trim(), age); setFresh({ studentId: r.studentId, code: r.accessCode }); setSid(''); setName(''); await load(aid); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Could not add'); }
    finally { setBusy(false); }
  };
  const reset = async (r: Row) => {
    if (!window.confirm(`Make a new access code for ${r.studentId}? The old code and any open session stop working.`)) return;
    try { const x = await api.rosterReset(aid, r.id); setFresh({ studentId: r.studentId, code: x.accessCode }); } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };
  const remove = async (r: Row) => {
    if (!window.confirm(`Remove ${r.studentId} and any submission they made? This cannot be undone.`)) return;
    try { await api.rosterRemove(aid, r.id); if (open === r.id) { setOpen(''); setDetail(null); } await load(aid); } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };
  const view = async (r: Row) => {
    setOpen(r.id); setDetail(null);
    try {
      const d = await api.rosterSubmission(aid, r.id); setDetail(d);
      const m: Record<string, { marks: string; reason: string }> = {};
      for (const q of d.questions) { const x = d.marks[q.id]; m[q.id] = { marks: x ? String(x.marks) : '', reason: x?.reason || '' }; }
      setMk(m);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };
  const saveMark = async (q: any) => {
    const v = mk[q.id]; const n = Number(v.marks);
    if (v.marks === '' || !Number.isInteger(n) || n < 0 || n > q.marks) { toast.error(`Marks must be a whole number from 0 to ${q.marks}`); return; }
    try { await api.rosterMark(aid, open, q.id, n, v.reason); toast.success('Marks saved'); const d = await api.rosterSubmission(aid, open); setDetail(d); await load(aid); } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };
  const release = async (released: boolean) => {
    try { await api.rosterRelease(aid, open, released); toast.success(released ? 'Marks shared with the student' : 'Marks hidden from the student'); setDetail({ ...detail, released }); await load(aid); } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main className="main-content" style={{ marginLeft: 248, flex: 1, minWidth: 0 }}>
        <Topbar>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push(aid ? `/output/${aid}` : '/assignments')} style={{ gap: 6 }}><ArrowLeft size={14} /> Back</button>
        </Topbar>
        <div style={{ padding: '20px 28px 60px', maxWidth: 820 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Students and submissions</h1>
          <p style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 14 }}>
            You choose each student ID. The ID is not a password: every student also gets a random access code that you pass to them yourself. Students sign in at <b>/student</b> on this site, answer in typed text, and you mark by hand. Student answers are stored in this app and are not sent to any AI service by default. The only exceptions are the built-in SYNTHETIC demo answers on the one approved demo paper, and one named adult pilot student who ticks a consent box (at most 6 requests to Typesafe, teacher-only draft, never marks). Use an ID or first name only, and follow your school's rules for student data. This has not been security audited.
          </p>
          <p style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 14 }}>
            Age group (a group only, never a date of birth) does two things. Under 18 and not set: answers are never offered for AI drafting, marking is by you only. 18 or over: the student can record whether they agree to AI drafting, but typed answers are sent to an AI service only for the one named pilot student after they tick the box, and for nobody else. It never changes marks: the same answer gets the marks you give it. It only changes how the marks you shared are worded to the student (shorter and simpler for under 18 and not set, fuller for 18 or over). Wording uses only your marks and comment.
          </p>
          {!aid && !loading && <p style={{ fontSize: 13 }}>Open this page from an assignment.</p>}
          {aid && (
            <form onSubmit={add} className="card" style={{ padding: '14px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
              <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: 12, fontWeight: 600 }}>Student ID</label><input className="input" required value={sid} onChange={e => setSid(e.target.value)} placeholder="e.g. 7B-014" style={{ marginTop: 4 }} /></div>
              <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: 12, fontWeight: 600 }}>Name (optional)</label><input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={60} style={{ marginTop: 4 }} /></div>
              <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: 12, fontWeight: 600 }}>Age group</label><select className="input" value={age} onChange={e => setAge(e.target.value)} style={{ marginTop: 4 }}><option value="unknown">Not set</option><option value="under18">Under 18</option><option value="adult">18 or over</option></select></div>
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
                <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>{r.submitted ? `Submitted ${new Date(r.submittedAt as string).toLocaleString()}${r.late ? ', late' : ''}${r.markedTotal ? ` - marked ${r.markedTotal}/${max}` : ''}${r.released ? ' - shared' : ''}` : 'Not submitted'}</p>
              </div>
              <select className="input" aria-label={`Age group for ${r.studentId}`} value={r.ageGroup || 'unknown'} onChange={async e => { try { await api.rosterAge(aid, r.id, e.target.value); await load(aid); } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Could not save'); } }} style={{ width: 120, fontSize: 12 }}><option value="unknown">Not set</option><option value="under18">Under 18</option><option value="adult">18 or over</option></select>
              {r.submitted && <button className="btn btn-orange btn-sm" onClick={() => view(r)}>Review</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => reset(r)}>New code</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(r)}>Remove</button>
            </div>
          ))}
          {open && detail && (
            <div className="card" style={{ padding: '16px 20px', marginTop: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Review: {detail.student.studentId}</h3>
              <p style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 12 }}>You decide the marks. The marking guide and answer key are AI drafts for your reference only. Marks are hidden from the student until you share them.</p>
              {detail.questions.map((q: any, qi: number) => (
                <div key={q.id} style={{ borderTop: qi ? '1px solid var(--border)' : 'none', paddingTop: qi ? 12 : 0, marginTop: qi ? 12 : 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{q.number}. {q.text} <span style={{ color: 'var(--gray-500)', fontWeight: 500 }}>[max {q.marks}]</span></p>
                  <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: '6px 0', padding: '8px 10px', background: 'var(--gray-50)', borderRadius: 8 }}>{detail.answers[q.id] || '(no answer)'}</p>
                  {(() => { const dr = detail.draft?.[q.id]; if (!dr) return null; return (
                    <div style={{ margin: '6px 0', padding: '8px 10px', border: '1px dashed var(--gray-300)', borderRadius: 8, fontSize: 12 }} role="status">
                      <b>{dr.pilot ? 'AI draft for you only (consented single-student pilot, not final marks)' : 'AI draft for you only (SYNTHETIC demo, not final marks)'}</b>
                      {dr.state === 'pending' && <p style={{ margin: '4px 0 0' }}>Drafting... <button className="btn btn-sm" onClick={() => view({ id: open } as Row)}>Refresh</button></p>}
                      {dr.state === 'failed' && <p style={{ margin: '4px 0 0' }}>No draft: {dr.note || 'Mark by hand.'}</p>}
                      {dr.state === 'done' && <>
                        <p style={{ margin: '4px 0 0' }}>Suggested marks: <b>{dr.marks}/{q.marks}</b>. Model-reported confidence {Math.round(dr.confidence * 100)}% (not an accuracy figure). Model {dr.model}.</p>
                        <p style={{ margin: '4px 0 0' }}>Matching marking-guide level (this is the guide text, not AI reasoning): {dr.guideText}</p>
                        {dr.scoreOnly && <p style={{ margin: '4px 0 0', color: 'var(--gray-500)' }}>Score-only pilot: one score question, no supporting checks and no AI explanation. The text above is your own marking guide.</p>}
                        {Array.isArray(dr.checklist) && dr.checklist.length > 0 && (() => {
                          const by = (st: string) => dr.checklist.filter((c: any) => c.status === st).map((c: any) => c.point);
                          const cov = by('covered'), unc = [...by('uncertain'), ...by('unknown')], nc = by('not covered');
                          const review = unc.length > 0 || dr.confidence < 0.7;
                          return (<div style={{ margin: '6px 0 0', padding: '6px 8px', background: 'var(--gray-50)', borderRadius: 6 }}>
                            <p style={{ margin: 0 }}><b>Grade and supporting checks</b></p>
                            <p style={{ margin: '4px 0 0' }}>Draft grade: {dr.marks}/{q.marks}, the closest marking-guide level (shown above). Jev's separate key-point checks: covered {cov.length}{cov.length ? ` (${cov.join('; ')})` : ''}; not covered {nc.length}{nc.length ? ` (${nc.join('; ')})` : ''}; uncertain {unc.length}{unc.length ? ` (${unc.join('; ')})` : ''}.</p>
                            {review && <p style={{ margin: '4px 0 0', color: '#b45309' }}>Needs your review: {unc.length > 0 ? 'some points are uncertain' : 'the model-reported confidence is low'}. Read the answer against the marking guide before you save marks.</p>}
                            <p style={{ margin: '4px 0 0', color: 'var(--gray-500)' }}>The grade is not calculated from these checks and no formula links them. The checks come from Jev's yes/no answers; this summary is assembled by the app, not written by Jev. Percentages are model-reported, not proof.</p>
                          </div>); })()}
                        {Array.isArray(dr.checklist) && dr.checklist.length > 0 && <div style={{ margin: '6px 0 0' }}>
                          <p style={{ margin: 0 }}>Key points checked (yes/no questions answered by Jev, model-reported likelihood, not proof):</p>
                          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{dr.checklist.map((c: any, i: number) => <li key={i}>{c.status === 'covered' ? 'Covered' : c.status === 'not covered' ? 'Not covered' : c.status === 'uncertain' ? 'Uncertain' : 'No answer'}: {c.point}{c.p !== null && c.p !== undefined ? ` (${Math.round(c.p * 100)}%)` : ''}</li>)}</ul>
                        </div>}
                        <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => setMk({ ...mk, [q.id]: { marks: String(dr.marks), reason: mk[q.id]?.reason || '' } })}>Copy into marks box (you still save)</button>
                      </>}
                    </div>); })()}
                  {detail.preview?.[q.id] && <p style={{ fontSize: 12, margin: '6px 0', padding: '6px 8px', background: 'var(--gray-50)', borderRadius: 6 }}><b>What the student will see once you share ({detail.student.ageGroup === 'adult' ? '18 or over wording' : detail.student.ageGroup === 'under18' ? 'under 18 wording' : 'age group not set, simple wording'}), from your saved marks:</b> {detail.preview[q.id].text}</p>}
                  {q.answerKey && <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>Answer key (AI draft): {q.answerKey}</p>}
                  {q.rubric.length === 3 && <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>Levels (AI draft): {q.rubric.map((l: any) => `${l.marks}: ${l.descriptor}`).join(' | ')}</p>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <input className="input" type="number" min={0} max={q.marks} value={mk[q.id]?.marks ?? ''} onChange={e => setMk({ ...mk, [q.id]: { ...mk[q.id], marks: e.target.value } })} style={{ width: 70, height: 34, fontSize: 13 }} aria-label={`Marks for question ${q.number}`} />
                    <input className="input" value={mk[q.id]?.reason ?? ''} maxLength={500} placeholder="Comment (optional)" onChange={e => setMk({ ...mk, [q.id]: { ...mk[q.id], reason: e.target.value } })} style={{ flex: '1 1 200px', height: 34, fontSize: 13 }} aria-label={`Comment for question ${q.number}`} />
                    <button className="btn btn-orange btn-sm" onClick={() => saveMark(q)}>Save marks</button>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => release(!detail.released)}>{detail.released ? 'Hide marks from student' : 'Share marks with student'}</button>
                <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{detail.released ? 'The student can see marks and comments.' : 'The student cannot see marks yet.'}</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
