'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, auth } from '@/lib/api';

// Client-side redirect only. Real protection is on the API: every data route needs a valid session cookie.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (path === '/login' || path === '/student') { setReady(true); return; }
    let live = true;
    api.me().then((u) => { auth.save(u.email); if (live) setReady(true); }).catch(() => { if (live) router.replace('/login'); });
    return () => { live = false; };
  }, [path, router]);
  if (!ready && path !== '/login' && path !== '/student') return null;
  return <>{children}</>;
}
