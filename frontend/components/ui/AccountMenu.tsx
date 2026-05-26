'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, User, Settings, BookOpen, LogOut, HelpCircle, Bell, Star } from 'lucide-react';

export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const items = [
    { icon: User,       label: 'My Profile',        action: () => {} },
    { icon: BookOpen,   label: 'My Assignments',     action: () => { router.push('/assignments'); setOpen(false); } },
    { icon: Settings,   label: 'Settings',           action: () => {} },
    { icon: Bell,       label: 'Notification prefs', action: () => {} },
    { icon: HelpCircle, label: 'Help & Support',     action: () => {} },
    { icon: Star,       label: 'Upgrade to Pro',     action: () => {}, highlight: true },
    { icon: LogOut,     label: 'Sign Out',            action: () => {}, danger: true },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}
        style={{ gap: 7, cursor: 'pointer' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#F97316,#FB923C)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>JD</div>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>John Doe</span>
        <ChevronDown size={13} color="#6B7280" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </div>

      {open && (
        <div className="slide-down" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 220, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden' }}>
          {/* Profile header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(135deg,#FFF4EE,#fff)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#F97316,#FB923C)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>JD</div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>John Doe</p>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>john.doe@dps.edu.in</p>
              </div>
            </div>
            <div style={{ marginTop: 10, padding: '5px 10px', background: 'var(--orange-dim)', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F97316', display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#F97316' }}>Free Plan</span>
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: '6px 0' }}>
            {items.map(({ icon: Icon, label, action, highlight, danger }) => (
              <div key={label} onClick={action}
                style={{ padding: '9px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: danger ? '#DC2626' : highlight ? '#F97316' : '#374151', fontWeight: highlight || danger ? 600 : 400, transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = danger ? '#FEF2F2' : highlight ? '#FFF4EE' : '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Icon size={14} />
                {label}
                {highlight && <span style={{ marginLeft: 'auto', fontSize: 10, background: '#F97316', color: '#fff', padding: '1px 6px', borderRadius: 20, fontWeight: 700 }}>PRO</span>}
              </div>
            ))}
          </div>

          <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
            Delhi Public School, Bokaro Steel City
          </div>
        </div>
      )}
    </div>
  );
}
