'use client';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/ui/Topbar';
import { useAssignmentStore } from '@/store/assignmentStore';
import { useEffect, useState } from 'react';
import { BookOpen, FileText, TrendingUp, ArrowRight, Plus, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

const STATUS_BADGE: Record<string,string> = { completed:'badge badge-green', processing:'badge badge-blue', pending:'badge badge-yellow', failed:'badge badge-red' };

export default function HomePage() {
  const router = useRouter();
  const { assignments, fetchAssignments, initWebSocket } = useAssignmentStore();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') initWebSocket();
    fetchAssignments().finally(() => setLoaded(true));
  }, []);

  const recent    = assignments.slice(0, 5);
  const completed = assignments.filter(a => a.status === 'completed').length;
  const pending   = assignments.filter(a => a.status === 'pending' || a.status === 'processing').length;

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar />
      <main className="main-content" style={{ marginLeft:248, flex:1, minWidth:0 }}>
        <Topbar title="Home" />

        <div style={{ padding:'24px 28px 60px' }}>
          {/* Hero */}
          <div className="fade-up" style={{ background:'var(--black)', borderRadius:16, padding:'28px 32px', marginBottom:20, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', right:-30, top:-30, width:220, height:220, borderRadius:'50%', background:'rgba(249,115,22,0.08)', animation:'float 4s ease-in-out infinite' }} />
            <div style={{ position:'absolute', right:60, bottom:-50, width:150, height:150, borderRadius:'50%', background:'rgba(249,115,22,0.05)', animation:'float 5s ease-in-out infinite 1s' }} />
            <div style={{ position:'relative' }}>
              <p style={{ fontSize:12, color:'#9CA3AF', marginBottom:4, letterSpacing:'0.5px', textTransform:'uppercase' }}>Good morning</p>
              <h1 style={{ fontSize:26, fontWeight:700, color:'#fff', marginBottom:6, letterSpacing:'-0.5px' }}>John Doe</h1>
              <p style={{ fontSize:14, color:'#6B7280', marginBottom:24, maxWidth:380 }}>Create AI-powered question papers for your classes in seconds.</p>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <Link href="/create" style={{ textDecoration:'none' }}>
                  <button className="btn btn-orange btn-lg"><Plus size={15} /> Create Assignment</button>
                </Link>
                <Link href="/ai-toolkit" style={{ textDecoration:'none' }}>
                  <button className="btn btn-lg" style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.15)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='rgba(255,255,255,0.08)')}>
                    <Sparkles size={14} /> AI Toolkit
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid stagger" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Total Assignments', value:assignments.length, icon:BookOpen,   color:'#F97316', bg:'#FFF4EE' },
              { label:'Completed',         value:completed,          icon:FileText,   color:'#22C55E', bg:'#F0FDF4' },
              { label:'In Progress',       value:pending,            icon:TrendingUp, color:'#6366F1', bg:'#EEF2FF' },
            ].map(({ label, value, icon:Icon, color, bg }) => (
              <div key={label} className="card fade-up" style={{ padding:'18px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <span style={{ fontSize:12, color:'var(--gray-500)', fontWeight:500 }}>{label}</span>
                  <div style={{ width:32, height:32, borderRadius:9, background:bg, display:'flex', alignItems:'center', justifyContent:'center', transition:'transform 0.2s' }}
                    onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.15) rotate(6deg)')}
                    onMouseLeave={e=>(e.currentTarget.style.transform='none')}>
                    <Icon size={15} color={color} />
                  </div>
                </div>
                <div style={{ fontSize:30, fontWeight:700, color:'var(--black)', letterSpacing:'-1px' }}>
                  {loaded ? value : <span className="skeleton" style={{ width:40, height:30, display:'inline-block' }} />}
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div style={{ marginBottom:24 }}>
            <h2 style={{ fontSize:14, fontWeight:600, color:'var(--black)', marginBottom:12 }}>Quick Actions</h2>
            <div className="stagger" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:10 }}>
              {[
                { href:'/create',      label:'Create Assignment',    desc:'Generate a new AI paper',    bg:'#F97316', fg:'#fff'     },
                { href:'/ai-toolkit',  label:"AI Teacher's Toolkit", desc:'Edit & customise papers',    bg:'#fff',    fg:'#1A1A1A'  },
                { href:'/assignments', label:'View Assignments',      desc:'Browse all assignments',     bg:'#fff',    fg:'#1A1A1A'  },
                { href:'/library',     label:'My Library',            desc:'Saved templates & papers',   bg:'#fff',    fg:'#1A1A1A'  },
              ].map(({ href, label, desc, bg, fg }) => (
                <Link key={href} href={href} style={{ textDecoration:'none' }}>
                  <div className="card fade-up" style={{ padding:'16px 18px', cursor:'pointer', background:bg, border: bg==='#fff'?'1px solid var(--border)':'none', transition:'all 0.2s cubic-bezier(0.22,1,0.36,1)' }}
                    onMouseEnter={e=>{const el=e.currentTarget as HTMLDivElement; el.style.transform='translateY(-3px)'; el.style.boxShadow=bg==='#F97316'?'0 6px 24px rgba(249,115,22,0.35)':'0 6px 20px rgba(0,0,0,0.08)';}}
                    onMouseLeave={e=>{const el=e.currentTarget as HTMLDivElement; el.style.transform=''; el.style.boxShadow='';}}>
                    <div style={{ fontSize:13, fontWeight:600, color:fg, marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:12, color:bg==='#F97316'?'rgba(255,255,255,0.75)':'#9CA3AF' }}>{desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent */}
          {loaded && recent.length > 0 && (
            <div className="fade-up">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <h2 style={{ fontSize:14, fontWeight:600, color:'var(--black)' }}>Recent Assignments</h2>
                <Link href="/assignments" style={{ textDecoration:'none', fontSize:13, color:'var(--orange)', fontWeight:500, display:'flex', alignItems:'center', gap:4 }}>
                  View all <ArrowRight size={13} />
                </Link>
              </div>
              <div className="stagger" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {recent.map(a => (
                  <div key={a._id} className="card card-hover card-clickable fade-up"
                    onClick={()=>router.push(a.status==='completed'?`/output/${a._id}`:'/assignments')}
                    style={{ padding:'13px 16px', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:9, background:'var(--orange-dim)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'transform 0.2s' }}
                      onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.1) rotate(-5deg)')}
                      onMouseLeave={e=>(e.currentTarget.style.transform='none')}>
                      <BookOpen size={15} color="#F97316" />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--black)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2 }}>{a.title}</div>
                      <div style={{ fontSize:12, color:'var(--gray-400)' }}>{a.subject} · Due {format(new Date(a.dueDate),'dd MMM yyyy')}</div>
                    </div>
                    <span className={STATUS_BADGE[a.status]||'badge badge-gray'}>{a.status}</span>
                    <ArrowRight size={13} color="#D1D5DB" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {loaded && assignments.length === 0 && (
            <div className="card fade-up" style={{ padding:'52px 32px', textAlign:'center' }}>
              <div className="float" style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
                <BookOpen size={48} color="#E5E7EB" />
              </div>
              <h3 style={{ fontSize:16, fontWeight:600, marginBottom:8, color:'var(--black)' }}>No assignments yet</h3>
              <p style={{ color:'var(--gray-400)', fontSize:13, marginBottom:20 }}>Create your first assignment to get started.</p>
              <Link href="/create"><button className="btn btn-primary">+ Create Assignment</button></Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
