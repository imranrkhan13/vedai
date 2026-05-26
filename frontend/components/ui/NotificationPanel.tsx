'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, X, CheckCircle, Clock, AlertCircle, BookOpen } from 'lucide-react';
import { useAssignmentStore } from '@/store/assignmentStore';

interface Notif {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const MOCK_NOTIFS: Notif[] = [
  { id: '1', type: 'success', title: 'Assignment generated', body: 'Quiz on Electricity has been generated successfully.', time: '2 min ago', read: false },
  { id: '2', type: 'info',    title: 'New feature available', body: 'Try the AI Teacher\'s Toolkit to edit your question papers.', time: '1 hr ago', read: false },
  { id: '3', type: 'warning', title: 'Due date approaching', body: 'Chapter 5 Test is due in 2 days.', time: '3 hrs ago', read: true },
  { id: '4', type: 'success', title: 'PDF exported', body: 'Your question paper has been downloaded.', time: 'Yesterday', read: true },
];

const ICON = { success: CheckCircle, info: BookOpen, warning: Clock, error: AlertCircle };
const COLOR = { success: '#22C55E', info: '#6366F1', warning: '#F59E0B', error: '#EF4444' };
const BG    = { success: '#F0FDF4', info: '#EEF2FF', warning: '#FFFBEB', error: '#FEF2F2' };

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>(MOCK_NOTIFS);
  const ref = useRef<HTMLDivElement>(null);
  const { assignments } = useAssignmentStore();

  const unread = notifs.filter(n => !n.read).length;

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Add real notifications from assignments
  useEffect(() => {
    const newNotifs: Notif[] = assignments
      .filter(a => a.status === 'completed')
      .slice(0, 3)
      .map(a => ({
        id: `asgn_${a._id}`,
        type: 'success' as const,
        title: 'Paper ready',
        body: `"${a.title}" question paper generated — ${a.numberOfQuestions} questions, ${a.totalMarks} marks.`,
        time: 'Recently',
        read: false,
      }));

    setNotifs(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const merged = [...newNotifs.filter(n => !existingIds.has(n.id)), ...prev];
      return merged.slice(0, 10);
    });
  }, [assignments.length]);

  const markAll = () => setNotifs(n => n.map(x => ({ ...x, read: true })));
  const markOne = (id: string) => setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
  const remove  = (id: string) => setNotifs(n => n.filter(x => x.id !== id));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm"
        onClick={() => setOpen(o => !o)}
        style={{ width: 34, height: 34, padding: 0, borderRadius: '50%', position: 'relative' }}>
        <Bell size={15} color={open ? '#F97316' : '#6B7280'} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: '#EF4444', border: '1.5px solid #fff', display: 'block', animation: 'pulse 2s infinite' }} />
        )}
      </button>

      {open && (
        <div className="slide-down" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>Notifications</h3>
              {unread > 0 && <p style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{unread} unread</p>}
            </div>
            <button onClick={markAll} style={{ fontSize: 11, color: '#F97316', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
              Mark all read
            </button>
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflow: 'auto' }}>
            {notifs.length === 0 && (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No notifications</div>
            )}
            {notifs.map(n => {
              const Icon = ICON[n.type];
              return (
                <div key={n.id} onClick={() => markOne(n.id)}
                  style={{ padding: '12px 16px', borderBottom: '1px solid #F9FAFB', display: 'flex', gap: 10, cursor: 'pointer', background: n.read ? '#fff' : '#FAFFFE', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.read ? '#fff' : '#FAFFFE')}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: BG[n.type], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} color={COLOR[n.type]} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: '#1A1A1A', marginBottom: 2 }}>{n.title}</p>
                    <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.4, marginBottom: 3 }}>{n.body}</p>
                    <p style={{ fontSize: 11, color: '#9CA3AF' }}>{n.time}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); remove(n.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 2, flexShrink: 0, transition: 'color 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}>
                    <X size={12} />
                  </button>
                  {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F97316', flexShrink: 0, marginTop: 5 }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
