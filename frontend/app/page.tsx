'use client';
import Link from 'next/link';
import { BookOpen, FileText, ListChecks, Users, ShieldCheck, ScanText, ArrowRight, Check } from 'lucide-react';

const STEPS = [
  { n: '1', title: 'Add your material', text: 'Type a topic or paste your notes. You can also upload a page of printed text and the app reads it for you.' },
  { n: '2', title: 'Get a draft paper', text: 'Choose question types, marks and difficulty. Ques-AI drafts the paper, an answer key and a three-level marking guide.' },
  { n: '3', title: 'Check and edit', text: 'Everything is a draft for you to review. Edit the guide, then download a clean student PDF and a separate teacher guide.' },
  { n: '4', title: 'Collect and mark', text: 'Give each student an ID and an access code. They type answers, you read them and enter the marks yourself.' },
];

const FEATURES = [
  { icon: BookOpen, title: 'Papers from your own notes', text: 'Questions can point back to a sentence in your notes, so you can see where an idea came from. It is a copy check, not proof the question is right.' },
  { icon: ListChecks, title: 'Editable marking guide', text: 'For questions worth 3 marks or more you get three levels with a sample answer each. Change any of it before you use it.' },
  { icon: FileText, title: 'Two separate PDFs', text: 'The student PDF has no answers. The teacher guide has the answers, source sentences and marking levels.' },
  { icon: Users, title: 'Student IDs you control', text: 'You choose each student ID. The ID alone does not let anyone in: every student also gets a random access code from you.' },
  { icon: ScanText, title: 'Printed text upload', text: 'Upload a page of printed English text. Handwriting has not been tested and is not supported.' },
  { icon: ShieldCheck, title: 'Private to your account', text: 'Each teacher only sees their own papers and students. Student answers are not sent to any AI service.' },
];

const WORKS = [
  'Draft question papers with answer key and marking guide',
  'Editable three-level marking guide',
  'Student PDF and separate teacher guide PDF',
  'Teacher-assigned student IDs with private access codes',
  'Typed student answers, submitted once',
  'Teacher review queue with manual marks and comments',
  'Marks hidden from students until you share them',
];
const NOT = [
  'AI grading of real student answers is not switched on. A small demo uses made-up answers only.',
  'Photo, handwriting or PDF answer uploads are not built.',
  'Not security audited. Not ready for real classroom data until storage, retention and student-privacy rules are settled.',
  'Drafts can contain mistakes. A teacher must check every paper and every mark.',
];
const FAQ = [
  { q: 'Does the AI mark my students\u2019 work?', a: 'No. Teachers enter every mark by hand. There is a demo of AI scoring that uses made-up sample answers only, and it is not available for real students.' },
  { q: 'Are student answers sent to an AI service?', a: 'No. Typed answers are stored in the app for the teacher to review and are not sent to any AI service.' },
  { q: 'Can I use it with a real class?', a: 'Not yet for real student data. The app is a working demo and has not been security audited. Use made-up or consented pilot data only until data storage and deletion rules are settled.' },
  { q: 'What does it cost?', a: 'It is free to use right now and asks for no card.' },
  { q: 'How do students sign in?', a: 'Students open the student page and enter the ID and access code you gave them. Teachers pass codes on themselves, and a lost code can be replaced.' },
];

export default function Landing() {
  return (
    <div className="lp">
      <style>{`
        .lp { background:#fff; color:var(--black); }
        .lp a { text-decoration:none; }
        .lp-wrap { max-width:1080px; margin:0 auto; padding:0 20px; }
        .lp-nav { display:flex; align-items:center; justify-content:space-between; height:64px; gap:12px; }
        .lp-logo { display:flex; align-items:center; gap:9px; color:var(--black); font-weight:700; font-size:17px; letter-spacing:-0.3px; }
        .lp-logo i { width:32px; height:32px; border-radius:9px; background:#F97316; color:#fff; display:flex; align-items:center; justify-content:center; font-style:normal; font-size:16px; box-shadow:0 2px 8px rgba(249,115,22,0.35); }
        .lp-links { display:flex; gap:22px; font-size:13px; font-weight:500; }
        .lp-links a { color:var(--gray-500); }
        .lp-links a:hover { color:var(--black); }
        .lp-actions { display:flex; gap:8px; }
        .lp-hero { padding:56px 0 48px; text-align:center; background:linear-gradient(180deg,#FFF4EE 0%,#fff 100%); }
        .lp-pill { display:inline-block; font-size:12px; font-weight:600; color:#C2410C; background:#fff; border:1px solid var(--orange-border); border-radius:20px; padding:4px 12px; margin-bottom:18px; }
        .lp-h1 { font-size:44px; line-height:1.1; font-weight:700; letter-spacing:-1.2px; max-width:760px; margin:0 auto 16px; }
        .lp-sub { font-size:17px; line-height:1.6; color:var(--gray-500); max-width:620px; margin:0 auto 26px; }
        .lp-cta { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
        .lp-note { font-size:12px; color:var(--gray-500); margin-top:14px; }
        .lp-sec { padding:56px 0; }
        .lp-alt { background:var(--bg); }
        .lp-h2 { font-size:28px; font-weight:700; letter-spacing:-0.6px; text-align:center; margin-bottom:8px; }
        .lp-lead { font-size:14px; color:var(--gray-500); text-align:center; max-width:560px; margin:0 auto 32px; line-height:1.6; }
        .lp-grid { display:grid; gap:14px; }
        .lp-g4 { grid-template-columns:repeat(4,1fr); }
        .lp-g3 { grid-template-columns:repeat(3,1fr); }
        .lp-g2 { grid-template-columns:repeat(2,1fr); }
        .lp-card { background:#fff; border:1px solid var(--border); border-radius:14px; padding:20px; box-shadow:var(--shadow-sm); }
        .lp-ic { width:36px; height:36px; border-radius:10px; background:var(--orange-dim); color:#F97316; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
        .lp-card h3 { font-size:15px; font-weight:600; margin-bottom:6px; }
        .lp-card p { font-size:13px; color:var(--gray-500); line-height:1.6; }
        .lp-step { width:28px; height:28px; border-radius:50%; background:var(--black); color:#fff; font-size:13px; font-weight:600; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
        .lp-list { list-style:none; display:flex; flex-direction:column; gap:10px; }
        .lp-list li { display:flex; gap:10px; font-size:13px; line-height:1.55; color:var(--gray-700); }
        .lp-list svg { flex-shrink:0; margin-top:2px; }
        .lp-prev { max-width:640px; margin:36px auto 0; text-align:left; }
        .lp-faq details { background:#fff; border:1px solid var(--border); border-radius:12px; padding:14px 18px; margin-bottom:10px; }
        .lp-faq summary { font-size:14px; font-weight:600; cursor:pointer; }
        .lp-faq p { font-size:13px; color:var(--gray-500); line-height:1.6; margin-top:8px; }
        .lp-final { background:var(--black); color:#fff; border-radius:20px; padding:40px 24px; text-align:center; }
        .lp-final h2 { font-size:26px; font-weight:700; letter-spacing:-0.5px; margin-bottom:8px; }
        .lp-final p { font-size:14px; color:#D1D5DB; margin-bottom:20px; }
        .lp-foot { padding:28px 0 40px; font-size:12px; color:var(--gray-500); text-align:center; line-height:1.7; }
        @media (max-width: 900px) { .lp-g4 { grid-template-columns:repeat(2,1fr); } .lp-g3 { grid-template-columns:repeat(2,1fr); } .lp-links { display:none; } }
        @media (max-width: 600px) {
          .lp-h1 { font-size:32px; letter-spacing:-0.8px; }
          .lp-sub { font-size:15px; }
          .lp-g4, .lp-g3, .lp-g2 { grid-template-columns:1fr; }
          .lp-hero { padding:36px 0 36px; }
          .lp-sec { padding:40px 0; }
          .lp-h2 { font-size:23px; }
          .lp-actions .btn { padding:8px 11px; font-size:12px; }
        }
      `}</style>

      <header className="lp-wrap lp-nav">
        <Link href="/" className="lp-logo"><i>Q</i>Ques-AI</Link>
        <nav className="lp-links" aria-label="Sections">
          <a href="#how">How it works</a><a href="#features">Features</a><a href="#students">Students</a><a href="#status">Status</a><a href="#faq">FAQ</a>
        </nav>
        <div className="lp-actions">
          <Link href="/student" className="btn btn-ghost btn-sm">Student sign in</Link>
          <Link href="/login" className="btn btn-primary btn-sm">Teacher sign in</Link>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap">
          <span className="lp-pill">Working demo - free to try, no card</span>
          <h1 className="lp-h1">Question papers and marking guides, drafted from your own notes</h1>
          <p className="lp-sub">Ques-AI helps teachers draft a paper, an answer key and a marking guide in minutes. You check and edit everything. Students submit typed answers and you mark them yourself.</p>
          <div className="lp-cta">
            <Link href="/login" className="btn btn-primary" style={{ padding: '12px 22px' }}>I am a teacher <ArrowRight size={14} /></Link>
            <Link href="/student" className="btn btn-ghost" style={{ padding: '12px 22px' }}>I am a student</Link>
          </div>
          <p className="lp-note">Teachers create a free account on the sign in page. Students use the ID and access code their teacher gives them.</p>

          <div className="lp-card lp-prev" aria-label="Example of a drafted question">
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', letterSpacing: 0.4, marginBottom: 8 }}>EXAMPLE OF A DRAFTED QUESTION (ILLUSTRATION)</p>
            <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.6 }}>1. Explain how a plant makes food using sunlight. <span style={{ color: 'var(--gray-500)', fontWeight: 500 }}>[5 marks]</span></p>
            <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
              {[['5', 'Names chlorophyll, light, carbon dioxide, water, glucose and oxygen'], ['3', 'Gives the main idea but leaves out some parts'], ['0', 'Does not describe the process']].map(([m, d]) => (
                <div key={m} style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--gray-700)', background: 'var(--gray-50)', borderRadius: 8, padding: '8px 10px' }}><b style={{ minWidth: 14 }}>{m}</b><span>{d}</span></div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 10 }}>Marking levels are an AI draft. The teacher edits them and decides the final marks.</p>
          </div>
        </div>
      </section>

      <section className="lp-sec" id="how">
        <div className="lp-wrap">
          <h2 className="lp-h2">How it works</h2>
          <p className="lp-lead">Four steps from your notes to marked work.</p>
          <div className="lp-grid lp-g4">
            {STEPS.map(s => (<div key={s.n} className="lp-card"><div className="lp-step">{s.n}</div><h3>{s.title}</h3><p>{s.text}</p></div>))}
          </div>
        </div>
      </section>

      <section className="lp-sec lp-alt" id="features">
        <div className="lp-wrap">
          <h2 className="lp-h2">What you get</h2>
          <p className="lp-lead">Simple tools for the work around a test.</p>
          <div className="lp-grid lp-g3">
            {FEATURES.map(f => (<div key={f.title} className="lp-card"><div className="lp-ic"><f.icon size={18} /></div><h3>{f.title}</h3><p>{f.text}</p></div>))}
          </div>
        </div>
      </section>

      <section className="lp-sec" id="students">
        <div className="lp-wrap">
          <h2 className="lp-h2">For students</h2>
          <p className="lp-lead">Your teacher gives you a student ID and an access code. Open the student page, sign in, read the paper, type your answers and submit. You can submit once. Marks show up only when your teacher shares them.</p>
          <div className="lp-cta"><Link href="/student" className="btn btn-primary" style={{ padding: '12px 22px' }}>Student sign in <ArrowRight size={14} /></Link></div>
        </div>
      </section>

      <section className="lp-sec lp-alt" id="status">
        <div className="lp-wrap">
          <h2 className="lp-h2">Where things stand today</h2>
          <p className="lp-lead">Ques-AI is a working demo. Here is what is ready and what is not.</p>
          <div className="lp-grid lp-g2">
            <div className="lp-card"><h3 style={{ marginBottom: 12 }}>Working now</h3><ul className="lp-list">{WORKS.map(w => (<li key={w}><Check size={15} color="#22C55E" /><span>{w}</span></li>))}</ul></div>
            <div className="lp-card"><h3 style={{ marginBottom: 12 }}>Not ready yet</h3><ul className="lp-list">{NOT.map(w => (<li key={w}><span style={{ width: 15, flexShrink: 0, textAlign: 'center', color: '#F97316', fontWeight: 700 }}>!</span><span>{w}</span></li>))}</ul></div>
          </div>
        </div>
      </section>

      <section className="lp-sec" id="faq">
        <div className="lp-wrap" style={{ maxWidth: 720 }}>
          <h2 className="lp-h2">Questions</h2>
          <p className="lp-lead">Straight answers.</p>
          <div className="lp-faq">{FAQ.map(f => (<details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>))}</div>
        </div>
      </section>

      <section className="lp-wrap" style={{ paddingBottom: 40 }}>
        <div className="lp-final">
          <h2>Try it with your next test</h2>
          <p>Draft a paper from your notes and check it yourself.</p>
          <div className="lp-cta">
            <Link href="/login" className="btn btn-orange" style={{ padding: '12px 22px' }}>Teacher sign in</Link>
            <Link href="/student" className="btn" style={{ padding: '12px 22px', background: '#fff', color: 'var(--black)' }}>Student sign in</Link>
          </div>
        </div>
      </section>

      <footer className="lp-wrap lp-foot">
        <p>Ques-AI is a demo and has not been security audited. AI drafts can contain mistakes: teachers must check papers and marks. Use made-up or consented pilot data only.</p>
      </footer>
    </div>
  );
}
