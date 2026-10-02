'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, auth } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = mode === 'login' ? await api.login(email, password) : await api.register(email, password);
      auth.save(r.user.email);
      router.replace('/assignments');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not sign in');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 380, padding: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Ques-AI</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
          {mode === 'login' ? 'Sign in to see your assignments.' : 'Create a free teacher account. Your papers stay private to you.'}
        </p>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Email</label>
        <input className="input" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={{ marginBottom: 12, marginTop: 4 }} />
        <label style={{ fontSize: 12, fontWeight: 600 }}>Password</label>
        <input className="input" type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} style={{ marginTop: 4 }} />
        {mode === 'register' && <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>At least 8 characters.</p>}
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 18, justifyContent: 'center' }}>
          {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <p style={{ fontSize: 12, marginTop: 14, textAlign: 'center', color: 'var(--gray-500)' }}>
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <a href="#" onClick={e => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); }} style={{ color: 'var(--orange, #F97316)', fontWeight: 600 }}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </a>
        </p>
      </form>
    </div>
  );
}
