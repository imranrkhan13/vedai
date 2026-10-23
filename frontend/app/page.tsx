import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BookOpen, Check, FileCheck2, FileText, GraduationCap, LockKeyhole, MessageSquareText, Users, Download, ChevronDown } from 'lucide-react';
import AssessmentPreview from '@/components/landing/AssessmentPreview';
import './landing.css';

const steps = [
    { icon: BookOpen, title: 'Bring your class notes', text: 'Upload a TXT or text-based PDF, or paste your syllabus. Read the extracted text and fix anything that needs changing.', detail: 'No readable notes? Generation stays blocked.' },
    { icon: FileText, title: 'Choose the paper you need', text: 'Set the subject, due date, question types, number of questions and marks. Include the grade in your notes.', detail: 'Mix MCQs, short answers and longer questions.' },
    { icon: FileCheck2, title: 'Check the questions first', text: 'Review the draft questions, answer key and marking guide. Compare the questions with your notes before using them.', detail: 'Download separate student and teacher PDFs.' },
    { icon: Users, title: 'Give each student access', text: 'Add students to the assignment. Give each one their student ID and private access code so they can sign in.', detail: 'Students use their teacher-issued details.' },
    { icon: MessageSquareText, title: 'Students write and submit', text: 'Students choose one answer for each MCQ and type their written answers. Once submitted, their answers are locked.', detail: 'Their work is ready for your review.' },
    { icon: GraduationCap, title: 'Review, save, then share', text: 'MCQs use the answer key. Jev drafts written-answer marks and explanations. Check the work, enter final marks and save them before sharing.', detail: 'Students see results only when you release them.' },
];
const sources = [
    { platform: 'LinkedIn', type: 'Public post', title: 'Grading follows teachers home.', text: 'Preparing questions and marking answers can follow teachers into evenings and weekends.', response: 'Keep notes, papers, submissions and results together in one workflow.', image: '/research/linkedin-workload.jpg', alt: 'Cropped public LinkedIn post by Dr Sunita Gandhi discussing grading outside school hours', url: 'https://www.linkedin.com/posts/dr-sunita-gandhi_education-activity-7458412898407600128-otfi' },
    { platform: 'Hacker News', type: 'Community discussion', title: 'A clear mark needs a clear reason.', text: 'A score alone does not show which points a student understood or missed.', response: 'Review the suggested mark alongside specific marking points and an explanation.', image: '/research/hacker-news-consistency.jpg', alt: 'Excerpt of a Hacker News discussion about grading consistency', url: 'https://news.ycombinator.com/item?id=40097375' },
    { platform: 'EdSurge', type: 'Educator opinion', title: 'Teachers need to own the feedback.', text: 'AI feedback can sound convincing while missing important gaps in an answer.', response: 'Teachers check the work, save final marks and choose when to release results.', image: '/research/edsurge-teacher-review.jpg', alt: 'EdSurge opinion article by Steven Swanson on keeping teachers in charge of AI grading', url: 'https://www.edsurge.com/news/i-built-an-ai-grading-tool-then-a-student-thanked-me-for-words-i-didnt-write' },
];
const faqs = [
    ['Will AI decide the final marks?', 'No. MCQs are checked against one fixed answer. Written-answer marks from Jev are suggestions. You review the student’s work, enter or adjust the marks, save them and decide when students can see the results.'],
    ['Does a source excerpt prove a question is right?', 'No. It helps you locate text the model says it used. You still need to check that each question, answer and marking criterion follows from your notes and suits your class.'],
    ['What can I upload?', 'Use a readable TXT file, a text-based PDF, or paste your notes. The app also offers printed-image text reading; check that text carefully. Generation is blocked when the source is empty or unreadable.'],
    ['How do students sign in?', 'You assign each student an ID and a private access code for the assignment. They use those details in the student portal, answer the questions and submit their work.'],
    ['Can I print the paper?', 'Yes. Download a searchable student PDF and a separate teacher guide. The student export does not include the answer key, source excerpts or teacher marking guide.'],
    ['Can I use Quesly for important exams?', 'Start with a small, teacher-reviewed classroom trial. AI questions and written grading can make mistakes. Quesly has not established independently validated grading accuracy or suitability for high-stakes exams.'],
];

export default function Landing() {
    return <div className="landing qx">
        <a className="qx-skip" href="#main">Skip to content</a>

        <div className="qx-navwrap"><header className="qx-nav">
            <Link className="qx-brand" href="/" aria-label="Quesly home"><span className="qx-logo">q.</span>quesly<i>.</i></Link>
            <nav aria-label="Main navigation"><a href="#why">The problem</a><a href="#workflow">How it works</a><a href="#grading">Marking</a><a href="#questions">Questions?</a></nav>
            <Link className="qx-btn qx-btn-dark qx-btn-sm" href="/login">Teacher sign in <ArrowUpRight size={15} /></Link>
        </header></div>

        <main id="main">
            {/* HERO */}
            <section className="qx-hero qx-wrap">
                <div className="qx-hero-grid">
                    <div className="qx-hero-copy">
                        <p className="qx-eyebrow"><span />For the work around teaching</p>
                        <h1>From class notes to <em>clear feedback.</em></h1>
                        <p className="qx-lead">Make a question paper from your notes. Collect student answers. Review suggested marks and share the feedback you stand behind.</p>
                        <div className="qx-ctas">
                            <Link href="/login" className="qx-btn qx-btn-primary">Start a paper <ArrowRight size={18} /></Link>
                            <a href="#workflow" className="qx-link">See the whole process <ArrowRight size={16} /></a>
                        </div>
                        <ul className="qx-ticks"><li><Check size={15} />Your teaching material</li><li><Check size={15} />Your final decision</li></ul>
                        <Link href="/student" className="qx-student">Here to answer an assignment? <b>Student sign in <ArrowUpRight size={13} /></b></Link>
                    </div>
                    <div className="qx-hero-visual"><div className="qx-blob" aria-hidden="true" /><div className="qx-preview"><AssessmentPreview /></div></div>
                </div>

                <div className="qx-posts">
                    <div className="qx-posts-head"><h2>What teachers are talking about.</h2><p>Real public discussions. Open the original to read more. Independent of Quesly.</p></div>
                    <div className="qx-posts-grid">{sources.map(s =>
                        <a className="qx-post" key={s.platform} href={s.url} target="_blank" rel="noreferrer" aria-label={`Open the public ${s.platform} post about assessment`}>
                            <div className="qx-post-img"><img src={s.image} alt={s.alt} loading="eager" /></div>
                            <div className="qx-post-body"><span>{s.platform} · {s.type}</span><h3>{s.title}</h3><p>View the original <ArrowUpRight size={12} /></p></div>
                        </a>)}</div>
                </div>
            </section>

            {/* STRIP */}
            <div className="qx-strip"><div className="qx-wrap qx-strip-row"><span>One connected workflow</span><b>Your notes</b><ArrowRight size={16} /><b>A reviewed paper</b><ArrowRight size={16} /><b>Student answers</b><ArrowRight size={16} /><b>Teacher-approved marks</b></div></div>

            {/* PROBLEM */}
            <section className="qx-section qx-wrap" id="why">
                <div className="qx-head"><div><p className="qx-eyebrow"><span />The problem</p><h2>Too much marking.<br />Too little time to explain.</h2></div><p>Preparing papers, checking answers and explaining every mark can stretch beyond the school day. Automating the score alone does not solve that.</p></div>
                <div className="qx-problem-grid">{sources.map((s, i) =>
                    <article className="qx-problem" key={s.platform}>
                        <div className="qx-problem-top"><span className="qx-pill">{s.platform}</span><span className="qx-muted">{s.type}</span><b className="qx-idx">0{i + 1}</b></div>
                        <h3>{s.title}</h3>
                        <p>{s.text}</p>
                        <div className="qx-help"><span>How Quesly helps</span><p>{s.response}</p></div>
                        <a href={s.url} target="_blank" rel="noreferrer" className="qx-link">Read the original <ArrowUpRight size={14} /></a>
                    </article>)}</div>
                <p className="qx-note">Independent sources, not Quesly customers or endorsements. Screenshots are cropped public excerpts captured on 23 October 2026. These discussions explain the problem; they do not validate Quesly’s accuracy or prove time savings.</p>
                <p className="qx-note">Also discussed on Reddit: <a href="https://www.reddit.com/r/Teachers/comments/1xab5s3/admin_wants_to_mandate_using_ai_to_grade_essays/" target="_blank" rel="noreferrer">concerns about AI marks missing important gaps in students’ work <ArrowUpRight size={12} /></a>.</p>
            </section>

            {/* WORKFLOW */}
            <section id="workflow" className="qx-flow"><div className="qx-wrap">
                <div className="qx-head"><div><p className="qx-eyebrow"><span />How Quesly works</p><h2>One assessment.<br />From start to shared.</h2></div><p>You bring the lesson and the judgment.<br />Quesly connects the steps in between.</p></div>
                <div className="qx-steps">{steps.map((s, i) =>
                    <article key={s.title} className="qx-step">
                        <div className="qx-step-top"><span className="qx-num">0{i + 1}</span><span className="qx-ico"><s.icon size={22} /></span></div>
                        <h3>{s.title}</h3>
                        <p>{s.text}</p>
                        <div className="qx-detail"><Check size={14} />{s.detail}</div>
                    </article>)}</div>
            </div></section>

            {/* GRADING */}
            <section id="grading" className="qx-grading"><div className="qx-wrap qx-grading-grid">
                <div className="qx-grading-copy">
                    <p className="qx-eyebrow qx-eyebrow-light"><span />A different check for a different answer</p>
                    <h2>MCQs have an answer.<br />Written work needs <em>your judgment.</em></h2>
                    <p>See the proposed marks and the points an answer covers or misses. Read the student’s work before accepting a suggestion.</p>
                    <p className="qx-small">A confident AI answer can still be wrong. Final marks stay under your control.</p>
                </div>
                <div className="qx-gcards">
                    <article><div className="qx-gtitle"><Check size={19} /><span>Multiple choice</span><b>Exact check</b></div><h3>One correct option. A fixed score.</h3><p>The answer-key match gets full marks. Other choices get zero. Blank responses are checked locally, with no AI review.</p></article>
                    <article><div className="qx-gtitle"><MessageSquareText size={19} /><span>Written answers</span><b>AI draft</b></div><h3>A suggestion, with the marking points.</h3><p>Jev checks written responses against draft criteria. Review partial credit, valid alternative answers and any criteria that need correcting.</p></article>
                    <div className="qx-rule"><LockKeyhole size={19} /><p><strong>Save before you share.</strong> Missing marks or unsaved changes block sharing. Students see the result only after you release it.</p></div>
                </div>
            </div></section>

            {/* TAKEAWAYS */}
            <section className="qx-take qx-wrap">
                <div><span className="qx-ico"><Download size={22} /></span><h3>A paper you can use offline.</h3><p>Searchable student and teacher PDFs, kept separate.</p></div>
                <div><span className="qx-ico"><Users size={22} /></span><h3>A simple way for students to join.</h3><p>A teacher-issued ID and private code for their assignment.</p></div>
                <div><span className="qx-ico"><FileCheck2 size={22} /></span><h3>A result you choose to share.</h3><p>Review and save the marks before students see them.</p></div>
            </section>

            {/* FAQ */}
            <section className="qx-faq qx-wrap" id="questions">
                <div className="qx-faq-intro"><p className="qx-eyebrow"><span />A few good questions</p><h2>Know what to expect.</h2><p>Useful help, with clear limits.</p></div>
                <div className="qx-faq-list">{faqs.map(([q, a]) => <details key={q}><summary>{q}<ChevronDown size={18} /></summary><p>{a}</p></details>)}</div>
            </section>

            {/* FINAL */}
            <section className="qx-final-wrap qx-wrap"><div className="qx-final">
                <div><p className="qx-eyebrow qx-eyebrow-light"><span />Bring the lesson you already have</p><h2>Start with your next class.</h2><p>A small paper. A careful review. A clearer way to give feedback.</p></div>
                <Link href="/login" className="qx-btn qx-btn-light">Open the teacher workspace <ArrowRight size={18} /></Link>
            </div></section>
        </main>

        <footer className="qx-footer qx-wrap">
            <Link href="/" className="qx-brand"><span className="qx-logo">q.</span>quesly<i>.</i></Link>
            <p>Your notes. Your class. Your call.</p>
            <div><Link href="/student">Student portal <ArrowUpRight size={14} /></Link><Link href="/login">Teacher sign in <ArrowUpRight size={14} /></Link></div>
        </footer>

        <style>{`
.qx{--g:#1f6b4a;--g-mid:#2f8a62;--g-dark:#0f3d2a;--g-deep:#0a2b1d;--g-soft:#e3efe7;--g-tint:#f0f6f2;--paper:#f7f4ec;--paper-2:#efeadc;--card:#fffdf8;--ink:#14231b;--ink-2:#41524a;--line:#ddd8c8;background:var(--paper);color:var(--ink);overflow-x:hidden;scroll-behavior:smooth}
.qx *{box-sizing:border-box}
.qx h1,.qx h2,.qx h3{margin:0;color:inherit;letter-spacing:-.03em;line-height:1.05}
.qx p{margin:0}
.qx a{color:inherit;text-decoration:none}
.qx em{font-style:italic;color:var(--g)}
.qx-wrap{width:min(1200px,100% - 48px);margin-inline:auto}
.qx-skip{position:absolute;left:-999px;top:8px;background:var(--g);color:#fff;padding:8px 14px;border-radius:8px;z-index:100}
.qx-skip:focus{left:8px}

/* nav */
.qx-navwrap{position:sticky;top:0;z-index:50;padding:14px 24px;pointer-events:none}
.qx-nav{pointer-events:auto;max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:10px 12px 10px 20px;background:rgba(255,253,248,.85);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--line);border-radius:999px;box-shadow:0 8px 30px rgba(15,61,42,.08)}
.qx-nav nav{display:flex;gap:26px;font-size:14px;font-weight:600;color:var(--ink-2)}
.qx-nav nav a{transition:color .2s}.qx-nav nav a:hover{color:var(--g)}
.qx-brand{display:inline-flex;align-items:center;gap:8px;font-weight:800;font-size:22px;letter-spacing:-.04em}
.qx-brand i{font-style:normal;color:var(--g-mid)}
.qx-logo{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:var(--g);color:#fff;font-size:17px}

/* buttons */
.qx-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 28px;border-radius:999px;font-weight:700;font-size:15px;transition:transform .25s,box-shadow .25s,background .25s;cursor:pointer}
.qx-btn:hover{transform:translateY(-2px)}
.qx-btn-sm{min-height:40px;padding:0 18px;font-size:13.5px}
.qx-btn-primary{background:var(--g);color:#fff;box-shadow:0 10px 26px rgba(31,107,74,.32)}
.qx-btn-primary:hover{background:var(--g-dark);box-shadow:0 16px 34px rgba(15,61,42,.38)}
.qx-btn-dark{background:var(--g-dark);color:#fff}.qx-btn-dark:hover{background:var(--g)}
.qx-btn-light{background:var(--paper);color:var(--g-dark)}.qx-btn-light:hover{background:#fff}
.qx-link{display:inline-flex;align-items:center;gap:6px;font-weight:700;font-size:14.5px;color:var(--g);border-bottom:1.5px solid transparent;transition:border-color .2s,gap .2s}
.qx-link:hover{border-color:var(--g);gap:9px}
.qx-eyebrow{display:inline-flex;align-items:center;gap:10px;margin-bottom:18px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--g)}
.qx-eyebrow span{width:22px;height:2px;background:currentColor;border-radius:2px}
.qx-eyebrow-light{color:#9fd3b6}

/* hero */
.qx-hero{padding:34px 0 70px}
.qx-hero-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:56px;align-items:center}
.qx-hero h1{font-size:clamp(2.8rem,6vw,5.2rem);line-height:.96;letter-spacing:-.05em;font-weight:800}
.qx-lead{margin-top:24px;max-width:520px;font-size:1.15rem;line-height:1.65;color:var(--ink-2)}
.qx-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:22px;margin-top:32px}
.qx-ticks{display:flex;flex-wrap:wrap;gap:8px 22px;margin:28px 0 0;padding:0;list-style:none}
.qx-ticks li{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;color:var(--ink-2)}
.qx-ticks svg{padding:3px;width:20px;height:20px;border-radius:50%;background:var(--g-soft);color:var(--g)}
.qx-student{display:inline-flex;flex-wrap:wrap;gap:6px;margin-top:26px;padding:10px 16px;background:var(--card);border:1px dashed #b9c9bd;border-radius:14px;font-size:13.5px;color:var(--ink-2);transition:border-color .2s}
.qx-student:hover{border-color:var(--g)}
.qx-student b{display:inline-flex;align-items:center;gap:4px;color:var(--g)}
.qx-hero-visual{position:relative;min-width:0}
.qx-blob{position:absolute;inset:-6% -8% -8% 6%;border-radius:42% 58% 50% 50%/48% 40% 60% 52%;background:radial-gradient(circle at 30% 30%,#cfe5d7,#a8d0b9 60%,#8fc2a6);opacity:.75;animation:qxFloat 12s ease-in-out infinite}
.qx-preview{position:relative;z-index:1;padding:14px;background:rgba(255,253,248,.7);border:1px solid var(--line);border-radius:26px;box-shadow:0 40px 80px rgba(15,61,42,.18);backdrop-filter:blur(4px)}
@keyframes qxFloat{50%{transform:translateY(-14px) rotate(3deg)}}

/* posts */
.qx-posts{margin-top:80px;padding:34px;background:var(--card);border:1px solid var(--line);border-radius:30px}
.qx-posts-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px 30px;margin-bottom:24px}
.qx-posts-head h2{font-size:1.7rem;font-weight:800}
.qx-posts-head p{max-width:420px;font-size:14px;color:var(--ink-2)}
.qx-posts-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.qx-post{display:flex;flex-direction:column;overflow:hidden;background:var(--paper);border:1px solid var(--line);border-radius:20px;transition:transform .3s,box-shadow .3s,border-color .3s}
.qx-post:hover{transform:translateY(-5px);border-color:var(--g);box-shadow:0 20px 40px rgba(15,61,42,.12)}
.qx-post-img{height:170px;overflow:hidden;background:var(--paper-2);border-bottom:1px solid var(--line)}
.qx-post-img img{width:100%;height:100%;object-fit:cover;object-position:top;transition:transform .6s}
.qx-post:hover .qx-post-img img{transform:scale(1.04)}
.qx-post-body{padding:18px 20px 20px}
.qx-post-body span{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--g)}
.qx-post-body h3{margin:8px 0 10px;font-size:1.15rem;font-weight:800}
.qx-post-body p{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:700;color:var(--ink-2)}

/* strip */
.qx-strip{background:var(--g-dark);color:#e6f2ea;padding:18px 0}
.qx-strip-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px 16px}
.qx-strip-row span{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#8fc2a6;margin-right:8px}
.qx-strip-row b{padding:7px 16px;border:1px solid rgba(255,255,255,.2);border-radius:999px;font-size:13.5px;font-weight:700}
.qx-strip-row svg{color:#8fc2a6}

/* section heads */
.qx-section{padding:110px 0 20px}
.qx-head{display:grid;grid-template-columns:1.2fr 1fr;gap:40px;align-items:end;margin-bottom:46px}
.qx-head h2{font-size:clamp(2rem,4.2vw,3.4rem);font-weight:800;letter-spacing:-.045em}
.qx-head>p{font-size:1.05rem;line-height:1.65;color:var(--ink-2)}

/* problem */
.qx-problem-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.qx-problem{position:relative;display:flex;flex-direction:column;gap:14px;padding:28px;background:var(--card);border:1px solid var(--line);border-radius:26px;transition:transform .3s,box-shadow .3s,border-color .3s}
.qx-problem:hover{transform:translateY(-6px);border-color:var(--g);box-shadow:0 24px 50px rgba(15,61,42,.1)}
.qx-problem-top{display:flex;align-items:center;gap:10px}
.qx-pill{padding:5px 12px;background:var(--g-soft);color:var(--g-dark);border-radius:999px;font-size:11.5px;font-weight:800}
.qx-muted{font-size:12.5px;color:var(--ink-2)}
.qx-idx{margin-left:auto;font-size:2rem;font-weight:800;color:#d5dccf;letter-spacing:-.04em}
.qx-problem h3{font-size:1.5rem;font-weight:800}
.qx-problem>p{font-size:14.5px;line-height:1.65;color:var(--ink-2)}
.qx-help{margin-top:auto;padding:16px 18px;background:var(--g-tint);border-left:3px solid var(--g);border-radius:0 14px 14px 0}
.qx-help span{display:block;margin-bottom:6px;font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--g)}
.qx-help p{font-size:14px;font-weight:600;line-height:1.55;color:var(--ink)}
.qx-note{max-width:860px;margin-top:22px;font-size:12.5px;line-height:1.65;color:#6c7a72}
.qx-note a{color:var(--g);font-weight:700;text-decoration:underline;text-underline-offset:3px}

/* workflow */
.qx-flow{margin-top:110px;padding:100px 0;background:var(--paper-2);border-block:1px solid var(--line)}
.qx-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;counter-reset:s}
.qx-step{display:flex;flex-direction:column;padding:28px;background:var(--card);border:1px solid var(--line);border-radius:26px;transition:transform .3s,box-shadow .3s,background .3s,border-color .3s}
.qx-step:hover{transform:translateY(-6px);background:var(--g-dark);border-color:var(--g-dark);color:#fff;box-shadow:0 26px 50px rgba(15,61,42,.25)}
.qx-step-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:34px}
.qx-num{font-size:3.2rem;font-weight:800;line-height:1;letter-spacing:-.05em;color:var(--g)}
.qx-ico{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:var(--g-soft);color:var(--g);transition:all .3s}
.qx-step:hover .qx-num{color:#8fc2a6}
.qx-step:hover .qx-ico{background:rgba(255,255,255,.12);color:#fff}
.qx-step h3{font-size:1.3rem;font-weight:800}
.qx-step p{margin-top:10px;font-size:14.5px;line-height:1.65;color:var(--ink-2);transition:color .3s}
.qx-step:hover p{color:#c9dfd1}
.qx-detail{display:flex;align-items:flex-start;gap:8px;margin-top:auto;padding-top:20px;font-size:13px;font-weight:700;color:var(--g)}
.qx-detail svg{flex:none;margin-top:2px}
.qx-step:hover .qx-detail{color:#9fd3b6}
.qx-detail{border-top:0}

/* grading */
.qx-grading{padding:110px 0;background:var(--g-deep);color:#fff;position:relative;overflow:hidden}
.qx-grading::before{content:'';position:absolute;top:-30%;right:-10%;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle,rgba(47,138,98,.4),transparent 70%)}
.qx-grading-grid{position:relative;display:grid;grid-template-columns:1fr 1.1fr;gap:60px;align-items:center}
.qx-grading h2{font-size:clamp(2rem,4.2vw,3.4rem);font-weight:800;letter-spacing:-.045em;color:#fff}
.qx-grading h2 em{color:#8fd1ac}
.qx-grading-copy>p{margin-top:22px;max-width:480px;font-size:1.08rem;line-height:1.7;color:#c4dccf}
.qx-grading-copy>.qx-small{font-size:.95rem;color:#8fb3a0;padding-left:14px;border-left:2px solid #2f8a62}
.qx-gcards{display:grid;gap:16px}
.qx-gcards article{padding:26px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:24px;transition:background .3s,border-color .3s}
.qx-gcards article:hover{background:rgba(255,255,255,.1);border-color:#4ea77f}
.qx-gtitle{display:flex;align-items:center;gap:10px;margin-bottom:16px;font-size:13px;font-weight:700;color:#9fd3b6}
.qx-gtitle b{margin-left:auto;padding:4px 12px;background:#9fd3b6;color:var(--g-deep);border-radius:999px;font-size:11px;font-weight:800}
.qx-gcards h3{font-size:1.3rem;font-weight:800;color:#fff}
.qx-gcards article p{margin-top:10px;font-size:14.5px;line-height:1.65;color:#b6cfc0}
.qx-rule{display:flex;gap:14px;align-items:flex-start;padding:20px 24px;background:var(--paper);color:var(--ink);border-radius:20px}
.qx-rule svg{flex:none;margin-top:2px;color:var(--g)}
.qx-rule p{font-size:14.5px;line-height:1.6;color:var(--ink-2)}
.qx-rule strong{color:var(--g-dark)}

/* takeaways */
.qx-take{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding:100px 0 20px}
.qx-take>div{padding:28px;background:var(--card);border:1px solid var(--line);border-radius:24px}
.qx-take h3{margin:22px 0 8px;font-size:1.25rem;font-weight:800}
.qx-take p{font-size:14.5px;line-height:1.6;color:var(--ink-2)}

/* faq */
.qx-faq{display:grid;grid-template-columns:.8fr 1.4fr;gap:60px;padding:100px 0 40px}
.qx-faq-intro{position:sticky;top:110px;align-self:start}
.qx-faq h2{font-size:clamp(2rem,3.8vw,3rem);font-weight:800}
.qx-faq-intro>p:last-child{margin-top:14px;color:var(--ink-2);font-size:1.05rem}
.qx-faq-list{display:grid;gap:12px}
.qx-faq details{background:var(--card);border:1px solid var(--line);border-radius:20px;transition:border-color .25s,box-shadow .25s}
.qx-faq details[open]{border-color:var(--g);box-shadow:0 14px 34px rgba(15,61,42,.08)}
.qx-faq summary{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 26px;font-weight:800;font-size:1.02rem;cursor:pointer;list-style:none}
.qx-faq summary::-webkit-details-marker{display:none}
.qx-faq summary svg{flex:none;padding:5px;width:30px;height:30px;border-radius:50%;background:var(--g-soft);color:var(--g);transition:transform .3s}
.qx-faq details[open] summary svg{transform:rotate(180deg);background:var(--g);color:#fff}
.qx-faq details p{padding:0 26px 24px;font-size:14.5px;line-height:1.7;color:var(--ink-2)}

/* final */
.qx-final-wrap{padding:70px 0 90px}
.qx-final{position:relative;overflow:hidden;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:30px;padding:60px;border-radius:36px;background:linear-gradient(135deg,var(--g-dark),var(--g) 120%);color:#fff}
.qx-final::after{content:'q.';position:absolute;right:-20px;bottom:-90px;font-size:20rem;font-weight:800;line-height:1;letter-spacing:-.08em;color:rgba(255,255,255,.06);pointer-events:none}
.qx-final>*{position:relative;z-index:1}
.qx-final h2{font-size:clamp(2rem,4.2vw,3.3rem);font-weight:800;color:#fff}
.qx-final p:last-of-type{margin-top:14px;max-width:460px;font-size:1.08rem;color:#cfe5d8}
.qx-final .qx-eyebrow{margin-bottom:16px}

/* footer */
.qx-footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px 30px;padding:30px 0 44px;border-top:1px solid var(--line)}
.qx-footer p{color:var(--ink-2);font-size:14px}
.qx-footer div{display:flex;gap:22px}
.qx-footer div a{display:inline-flex;align-items:center;gap:4px;font-size:14px;font-weight:700;color:var(--g)}

/* responsive */
@media (max-width:1000px){
 .qx-nav nav{display:none}
 .qx-hero-grid,.qx-head,.qx-grading-grid,.qx-faq{grid-template-columns:1fr}
 .qx-posts-grid,.qx-problem-grid,.qx-steps,.qx-take{grid-template-columns:1fr 1fr}
 .qx-faq-intro{position:static}
 .qx-final{padding:44px 32px}
}
@media (max-width:640px){
 .qx-wrap{width:calc(100% - 32px)}
 .qx-navwrap{padding:10px 12px}
 .qx-posts-grid,.qx-problem-grid,.qx-steps,.qx-take{grid-template-columns:1fr}
 .qx-posts{padding:20px}
 .qx-section{padding-top:80px}.qx-flow{padding:70px 0;margin-top:80px}.qx-grading{padding:80px 0}
 .qx-final{padding:36px 24px;border-radius:28px}
 .qx-btn{width:100%}.qx-btn-sm{width:auto}
}
@media (prefers-reduced-motion:reduce){.qx *{animation:none!important;transition:none!important}}
  `}</style>
    </div>;
}