'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/api';

// Client-side redirect only. Real protection is on the API: every data route needs a valid token.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (path !== '/login' && !auth.token()) { router.replace('/login'); return; }
    setReady(true);
  }, [path, router]);
  if (!ready && path !== '/login') return null;
  return <>{children}</>;
}
