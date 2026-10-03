'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type Ask = { message: string; confirmLabel: string; resolve: (ok: boolean) => void };

// App confirmation dialog (replaces the browser's blocking window.confirm).
// Usage: const [confirm, confirmNode] = useConfirm(); if (!(await confirm('Message', 'Label'))) return; ... render {confirmNode}
export function useConfirm(): [(message: string, confirmLabel?: string) => Promise<boolean>, ReactNode] {
  const [ask, setAsk] = useState<Ask | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirm = useCallback((message: string, confirmLabel = 'Confirm') => new Promise<boolean>((resolve) => setAsk({ message, confirmLabel, resolve })), []);
  const close = (ok: boolean) => { if (ask) ask.resolve(ok); setAsk(null); };
  useEffect(() => { if (ask) cancelRef.current?.focus(); }, [ask]);
  const node = ask ? (
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}
      onKeyDown={(e) => { if (e.key === 'Escape') close(false); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-msg" className="card" style={{ maxWidth: 380, width: '100%', padding: 20 }}>
        <p id="confirm-msg" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>{ask.message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button ref={cancelRef} className="btn btn-ghost btn-sm" type="button" onClick={() => close(false)}>Cancel</button>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => close(true)}>{ask.confirmLabel}</button>
        </div>
      </div>
    </div>
  ) : null;
  return [confirm, node];
}
