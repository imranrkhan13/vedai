'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Home, BookOpen, Library, Sparkles, Settings, Menu, X } from 'lucide-react';

const NAV = [
  { href: '/home',        label: 'Home',                icon: Home },
  { href: '/assignments', label: 'Assignments',          icon: BookOpen },
  { href: '/library',     label: 'My Library',           icon: Library },
  { href: '/ai-toolkit',  label: "AI Teacher's Toolkit", icon: Sparkles },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const path = usePathname();
  return (
    <div style={{ width: 248, height: '100%', background: '#fff', borderRight: '1px solid #EBEBEB', display: 'flex', flexDirection: 'column', padding: '16px 12px' }}>
      {/* Logo */}
      <div style={{ padding: '4px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, boxShadow: '0 2px 8px rgba(249,115,22,0.35)', transition: 'transform 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'rotate(-5deg) scale(1.08)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>V</div>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.3px' }}>VedaAI</span>
        </Link>
        {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}><X size={16} /></button>}
      </div>

      {/* Create CTA */}
      <Link href="/create" style={{ textDecoration: 'none', marginBottom: 20 }} onClick={onClose}>
        <button className="btn btn-primary" style={{ width: '100%', borderRadius: 9, padding: '10px 14px', justifyContent: 'center' }}>
          + Create Assignment
        </button>
      </Link>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== '/home' && path.startsWith(href));
          return (
            <Link key={href} href={href} className={`nav-item${active ? ' active' : ''}`} onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, marginBottom: 2, fontSize: 13, cursor: 'pointer', textDecoration: 'none', transition: 'all 0.15s', color: active ? '#F97316' : '#6B7280', fontWeight: active ? 600 : 400, background: active ? '#FFF4EE' : 'transparent', position: 'relative' }}>
              <Icon size={16} />
              <span style={{ flex: 1 }}>{label}</span>
              {label === 'Assignments' && (
                <span style={{ background: '#F97316', color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '1px 6px', lineHeight: 1.6 }}>10</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, color: '#6B7280', fontSize: 13, cursor: 'pointer', transition: 'background 0.15s', marginBottom: 10 }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <Settings size={16} /> Settings
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9, background: '#F9FAFB', border: '1px solid #F3F4F6', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#F97316'; (e.currentTarget as HTMLDivElement).style.background = '#FFF4EE'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#F3F4F6'; (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#F97316,#FB923C)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0, boxShadow: '0 2px 6px rgba(249,115,22,0.3)' }}>JD</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>Delhi Public School</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>Bokaro Steel City</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop */}
      <aside className="sidebar-fixed" style={{ width: 248, minHeight: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 40 }}>
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <button className="mobile-menu" onClick={() => setOpen(true)}
        style={{ display: 'none', position: 'fixed', top: 13, left: 14, zIndex: 200, background: '#fff', border: '1px solid #EBEBEB', borderRadius: 8, padding: 7, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' }}>
        <Menu size={17} color="#1A1A1A" />
      </button>

      {/* Mobile drawer */}
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 99, animation: 'fadeIn 0.2s ease' }} />}
      <aside style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100, width: 248, transform: open ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1)', boxShadow: open ? '4px 0 24px rgba(0,0,0,0.12)' : 'none' }}>
        <SidebarContent onClose={() => setOpen(false)} />
      </aside>
    </>
  );
}
