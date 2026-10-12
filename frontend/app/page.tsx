import Link from 'next/link';
import { ArrowRight, BookOpen, Check, GraduationCap, Sparkles, Users, FileText, ArrowUpRight } from 'lucide-react';
import './landing.css';

const steps = [
  { icon: BookOpen, title: 'Start with your syllabus', text: 'Upload a PDF, text file or printed page. Choose the question types, difficulty and total marks.' },
  { icon: Sparkles, title: 'Make a paper your own', text: 'Generate questions and an answer key from your material. Review the paper before assigning it.' },
  { icon: Users, title: 'Invite your students', text: 'Assign a student ID and private access code. Students sign in and submit their answers online.' },
  { icon: FileText, title: 'Understand every mark', text: 'Review AI draft scores, supporting points and deductions. Save your final marks and share results.' },
];
export default function Landing() {
  return <div className="landing">
    <header className="landing-nav landing-wrap">
      <Link href="/" className="landing-brand"><span><GraduationCap size={22}/></span>Ques-AI</Link>
      <nav aria-label="Main navigation"><a href="#workflow">How it works</a><a href="#grading">Grading</a><Link href="/student">Student portal</Link></nav>
      <Link href="/login" className="landing-button secondary">Teacher sign in <ArrowUpRight size={15}/></Link>
    </header>
    <main>
      <section className="landing-hero landing-wrap">
        <div className="landing-copy">
          <div className="landing-eyebrow"><span/>LESS ADMIN. MORE TEACHING.</div>
          <h1>From syllabus<br/>to <em>understanding.</em></h1>
          <p>Bring your lessons. We’ll help with the questions, submissions and grading—so you can focus on what your students need next.</p>
          <div className="landing-ctas"><Link href="/login" className="landing-button primary">Create your assessment <ArrowRight size={18}/></Link><Link href="/student" className="landing-text-link">I’m a student <ArrowUpRight size={16}/></Link></div>
          <div className="landing-benefits"><span><Check size={14}/>Your syllabus, your questions</span><span><Check size={14}/>Teacher stays in control</span></div>
        </div>
        <div className="landing-preview" aria-label="Illustrative teacher grading preview">
          <div className="preview-top"><span><span className="preview-dot"/>ASSESSMENT WORKSPACE</span><span>Example</span></div>
          <div className="preview-heading"><div><p>GRADE 8 · SCIENCE</p><h2>The living world</h2></div><span className="preview-icon"><BookOpen size={23}/></span></div>
          <div className="preview-stats"><div><b>12</b><span>Questions</span></div><div><b>40</b><span>Total marks</span></div><div><b>24</b><span>Students</span></div></div>
          <div className="preview-answer"><div><span>QUESTION 04</span><b>5 marks</b></div><h3>Explain how plants make their own food.</h3><p>“Plants use sunlight, water and carbon dioxide to make glucose through photosynthesis.”</p></div>
          <div className="preview-grade"><div className="grade-score">4<span>/ 5</span></div><div><b>A mark with a reason.</b><p>Correct process and inputs. One mark deducted: oxygen as a product is missing.</p><span>Illustrative AI draft · teacher reviews</span></div></div>
          <div className="preview-bottom"><span><Check size={14}/>Submission received</span><span>Ready for your review <ArrowRight size={13}/></span></div>
        </div>
      </section>
      <div className="landing-strip"><div className="landing-wrap"><span>ONE CONNECTED CLASSROOM WORKFLOW</span><b>Syllabus</b><ArrowRight size={16}/><b>Questions</b><ArrowRight size={16}/><b>Student answers</b><ArrowRight size={16}/><b>Clear feedback</b></div></div>
      <section className="landing-workflow landing-wrap" id="workflow"><div className="section-intro"><span className="landing-eyebrow">FROM FIRST UPLOAD TO FINAL FEEDBACK</span><h2>A little less work.<br/>A lot more clarity.</h2><p>Everything an assessment needs, in a flow that makes sense for teachers and students.</p></div><div className="workflow-grid">{steps.map((s,i)=><article key={s.title}><div className="workflow-top"><s.icon size={24}/><span>0{i+1}</span></div><h3>{s.title}</h3><p>{s.text}</p></article>)}</div></section>
      <section className="landing-grading landing-wrap" id="grading"><div><span className="landing-eyebrow">FEEDBACK YOU CAN ACT ON</span><h2>The score is only<br/>the beginning.</h2><p>See what an answer gets right, what it misses, and why marks were deducted. Review each AI suggestion, adjust the score, and share feedback when you’re ready.</p><Link href="/login" className="landing-text-link">Open your teacher workspace <ArrowRight size={16}/></Link></div><div className="grading-details"><div><span className="check-circle"><Check size={17}/></span><section><h3>Evidence behind the score</h3><p>Question-level marks, explanations, covered concepts and missing points.</p></section></div><div><span className="check-circle"><Users size={17}/></span><section><h3>You make the final call</h3><p>AI scores are drafts. Teachers save final marks before releasing results.</p></section></div><div><span className="check-circle"><GraduationCap size={17}/></span><section><h3>A simple student experience</h3><p>A teacher-issued ID, private access code and one place to answer.</p></section></div></div></section>
      <section className="landing-final landing-wrap"><div><span>MAKE ROOM FOR BETTER TEACHING</span><h2>Your next assessment starts here.</h2><p>Upload your syllabus. Build a paper. Bring your class along.</p></div><Link href="/login" className="landing-button primary">Get started <ArrowRight size={18}/></Link></section>
    </main>
    <footer className="landing-footer landing-wrap"><Link href="/" className="landing-brand"><GraduationCap size={23}/>Ques-AI</Link><p>Thoughtful assessments. Clearer learning.</p><Link href="/student">Student sign in <ArrowUpRight size={14}/></Link></footer>
  </div>;
}
