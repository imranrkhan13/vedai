'use client';
import NotificationPanel from './NotificationPanel';
import AccountMenu from './AccountMenu';

interface TopbarProps {
  title?: string;
  breadcrumb?: string;
  children?: React.ReactNode;
}

export default function Topbar({ title, breadcrumb, children }: TopbarProps) {
  return (
    <div className="topbar">
      <div style={{ fontSize: 13, color: '#6B7280' }}>
        {breadcrumb ? (
          <span>{breadcrumb}</span>
        ) : title ? (
          <span style={{ fontWeight: 600, color: '#1A1A1A', fontSize: 14 }}>{title}</span>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {children}
        <NotificationPanel />
        <AccountMenu />
      </div>
    </div>
  );
}
