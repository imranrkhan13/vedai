'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, BookOpen, GraduationCap } from 'lucide-react';
import './login.css';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, auth } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = mode === 'login' ? await api.login(email, password) : await api.register(email, password);
      auth.save(r.user.email);
      const next = new URLSearchParams(window.location.search).get('next');
      router.replace(next && /^\/institution(?:#invite=[a-f0-9]{64})?$/.test(next) ? next : '/assignments');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not sign in');
    } finally { setBusy(false); }
  };

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Welcome to Quesly">
        <Link href="/" className="login-brand"><span>q.</span>quesly.</Link>
        <div className="login-story-copy"><p className="login-kicker">A LITTLE LESS PAPERWORK.</p><h1>More room<br/>for teaching.</h1><p>Turn your class notes into questions.<br/>Bring answers, marks and feedback together.</p></div>
        <svg className="login-illustration" viewBox="0 0 600 410" role="img" aria-labelledby="login-art-title"><title id="login-art-title">Illustration of a teacher’s desk with an open notebook, question paper and a growing plant</title>
          <ellipse cx="300" cy="367" rx="250" ry="24" fill="#c8d6bb"/>
          <circle cx="310" cy="175" r="151" fill="#e1e9d5"/>
          <g className="login-floating-paper" transform="rotate(9 377 164)"><rect x="302" y="57" width="182" height="223" rx="12" fill="#fffdf5" stroke="#325745" strokeWidth="2"/><rect x="324" y="81" width="87" height="12" rx="6" fill="#325745"/><path d="M324 117h136M324 131h101M324 189h136M324 203h109" stroke="#c3cfb7" strokeWidth="6" strokeLinecap="round"/><circle cx="334" cy="161" r="9" fill="#dce9d0"/><path d="m330 161 3 3 6-7" stroke="#325745" strokeWidth="2" fill="none"/><path d="M354 161h67" stroke="#95ac83" strokeWidth="6" strokeLinecap="round"/><rect x="325" y="230" width="55" height="23" rx="11" fill="#e0e9d5"/></g>
          <path d="M100 296q95-34 190-5v72q-95-28-190 4z" fill="#fffdf5" stroke="#325745" strokeWidth="2"/><path d="M290 291q95-29 190 5v71q-95-28-190-4z" fill="#f4efd9" stroke="#325745" strokeWidth="2"/><path d="M290 291v72M121 313q70-19 145-5M121 330q70-19 145-5M314 309q70-15 142 5M314 326q70-15 142 5" stroke="#b8c8ac" strokeWidth="3" fill="none"/>
          <path d="M107 280v-99" stroke="#325745" strokeWidth="4"/><path d="M107 240q-67-4-60-60 54 1 60 60M107 217q-2-65 53-66 1 50-53 66" fill="#739268"/><path d="M77 271h61l-9 67H88z" fill="#c8a671" stroke="#325745" strokeWidth="2"/>
          <g transform="rotate(-20 225 226)"><rect x="213" y="136" width="17" height="135" rx="5" fill="#d0ad70" stroke="#325745" strokeWidth="2"/><path d="m213 271 8 23 9-23" fill="#fffdf5" stroke="#325745" strokeWidth="2"/><path d="m218 285 3 9 4-9" fill="#325745"/></g>
          <path d="m479 107 5-13 5 13 13 5-13 5-5 13-5-13-13-5zM171 105l3-8 3 8 8 3-8 3-3 8-3-8-8-3z" fill="#b38e4e"/>
        </svg>
        <div className="login-story-footer"><BookOpen size={17}/><span>Your notes. Your class. Your final say.</span></div>
      </section>
      <section className="login-form-panel">
        <Link href="/" className="login-back">← Back to Quesly</Link>
        <div className="login-form-wrap"><p className="login-kicker">FOR TEACHERS & SCHOOL ADMINS</p><h2>{mode === 'login' ? 'Welcome back.' : 'Let’s get you started.'}</h2><p className="login-intro">{mode === 'login' ? 'Sign in to pick up where your class left off.' : 'Create your account and prepare your first paper.'}</p>
        <form onSubmit={submit}>
          <label htmlFor="teacher-email">Email address</label><input id="teacher-email" type="email" required autoComplete="email" placeholder="you@school.edu" value={email} onChange={e => setEmail(e.target.value)} disabled={busy}/>
          <label htmlFor="teacher-password">Password</label><div className="login-password"><input id="teacher-password" type={showPassword?'text':'password'} required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode==='register'?'Choose at least 8 characters':'Enter your password'} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div>
          {mode==='register'&&<p className="login-hint">Use at least 8 characters.</p>}
          <button className="login-submit" type="submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}<ArrowRight size={18}/></button>
          <p className="login-switch">{mode==='login'?'New to Quesly?':'Already have an account?'} <button type="button" disabled={busy} onClick={()=>{setMode(mode==='login'?'register':'login');setShowPassword(false);}}>{mode==='login'?'Create an account':'Sign in'}</button></p>
        </form>
        <div className="login-student"><GraduationCap size={24}/><div><strong>Here as a student?</strong><p>Use the ID and code your teacher gave you.</p></div><Link href="/student" aria-label="Open student sign in"><ArrowRight size={20}/></Link></div>
        <p className="login-school-note">Invited by your school? Sign in with the email on your invitation, then open your invitation link.</p>
        </div><p className="login-bottom">Thoughtful tools for everyday teaching.</p>
      </section>
    </main>
  );
}
