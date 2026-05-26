'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/ui/Topbar';
import { useAssignmentStore } from '@/store/assignmentStore';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Search, SlidersHorizontal, MoreVertical, Loader2, AlertCircle, RefreshCw, BookOpen, Hash, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_BADGE: Record<string,string> = { pending:'badge badge-yellow', processing:'badge badge-blue', completed:'badge badge-green', failed:'badge badge-red' };

export default function AssignmentsPage() {
  const router = useRouter();
  const { assignments, fetchAssignments, initWebSocket, backendOnline } = useAssignmentStore();
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [retrying, setRetrying] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') initWebSocket();
    fetchAssignments().finally(() => setLoading(false));
    const interval = setInterval(fetchAssignments, 4000);
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null); };
    document.addEventListener('mousedown', close);
    return () => { clearInterval(interval); document.removeEventListener('mousedown', close); };
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await api.deleteAssignment(id); toast.success('Deleted'); fetchAssignments(); }
    catch { toast.error('Failed to delete'); }
    setMenuOpen(null);
  };

  const filtered = assignments.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar />
      <main className="main-content" style={{ marginLeft:248, flex:1, minWidth:0 }}>
        <Topbar breadcrumb="Assignment">
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:500 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:backendOnline?'#22C55E':'#EF4444', display:'inline-block', boxShadow:backendOnline?'0 0 0 2px #BBF7D0':'0 0 0 2px #FECACA', transition:'all 0.3s' }} />
            <span style={{ color:backendOnline?'#15803D':'#DC2626' }}>{backendOnline?'Live':'Offline'}</span>
          </div>
        </Topbar>

        <div style={{ padding:'20px 28px' }}>
          {!loading && !backendOnline && (
            <div className="fade-up" style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
              <AlertCircle size={16} color="#DC2626" style={{ flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, fontWeight:600, color:'#DC2626' }}>Backend not running</p>
                <p style={{ fontSize:12, color:'#6B7280' }}>Run: <code style={{ background:'#F3F4F6', padding:'1px 5px', borderRadius:4, fontSize:11 }}>cd backend && npm start</code> + <code style={{ background:'#F3F4F6', padding:'1px 5px', borderRadius:4, fontSize:11 }}>npm run worker</code></p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={async()=>{setRetrying(true);await fetchAssignments();setRetrying(false);}}>
                <RefreshCw size={12} className={retrying?'spin':''} /> Retry
              </button>
            </div>
          )}

          <div style={{ marginBottom:16 }}>
            <h1 className="fade-up" style={{ fontSize:20, fontWeight:700, color:'var(--black)', marginBottom:3 }}>Assignments</h1>
            <p className="fade-up" style={{ fontSize:12, color:'var(--gray-400)' }}>Manage and create assignments for your classes.</p>
          </div>

          <div className="fade-up" style={{ display:'flex', gap:8, marginBottom:18, alignItems:'center', flexWrap:'wrap' }}>
            <button className="btn btn-ghost btn-sm"><SlidersHorizontal size={13} /> Filter By</button>
            <div style={{ flex:1, minWidth:200, position:'relative' }}>
              <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF', pointerEvents:'none' }} />
              <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search Assignment" style={{ paddingLeft:32, height:36, fontSize:13 }} />
            </div>
            <Link href="/create" style={{ textDecoration:'none' }}>
              <button className="btn btn-primary btn-sm">+ Create Assignment</button>
            </Link>
          </div>

          {loading && (
            <div className="grid-2col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[1,2,3,4,5,6].map(i=>(
                <div key={i} className="skeleton" style={{ height:86, borderRadius:10, animationDelay:`${i*80}ms` }} />
              ))}
            </div>
          )}

          {!loading && filtered.length===0 && backendOnline && (
            <div className="card fade-up" style={{ padding:'64px 32px', textAlign:'center' }}>
              <div className="float" style={{ margin:'0 auto 20px', width:80, height:80 }}>
                <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="33" cy="33" r="22" stroke="#E5E7EB" strokeWidth="2.5" fill="#F9FAFB"/>
                  <circle cx="33" cy="33" r="15" fill="#fff" stroke="#E5E7EB" strokeWidth="1.5"/>
                  <line x1="27" y1="27" x2="39" y2="39" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="39" y1="27" x2="27" y2="39" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="50" y1="50" x2="65" y2="65" stroke="#D1D5DB" strokeWidth="4" strokeLinecap="round"/>
                  <circle cx="12" cy="18" r="2" fill="#93C5FD" opacity="0.7"/>
                  <circle cx="62" cy="16" r="1.5" fill="#FCA5A5" opacity="0.7"/>
                  <circle cx="8" cy="50" r="1.5" fill="#6EE7B7" opacity="0.7"/>
                </svg>
              </div>
              <h2 style={{ fontSize:16, fontWeight:600, marginBottom:8, color:'var(--black)' }}>No assignments yet</h2>
              <p style={{ color:'var(--gray-400)', fontSize:13, maxWidth:340, margin:'0 auto 24px', lineHeight:1.6 }}>
                Create your first assignment to start collecting and grading student submissions.
              </p>
              <Link href="/create"><button className="btn btn-primary">+ Create Your First Assignment</button></Link>
            </div>
          )}

          {!loading && filtered.length>0 && (
            <>
              <div className="grid-2col stagger" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {filtered.map(a=>(
                  <div key={a._id} className="card card-hover fade-up"
                    onClick={()=>a.status==='completed'&&router.push(`/output/${a._id}`)}
                    style={{ padding:'14px 16px', cursor:a.status==='completed'?'pointer':'default', position:'relative' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                      <div style={{ flex:1, paddingRight:8 }}>
                        <h3 style={{ fontWeight:600, fontSize:14, color:'var(--black)', lineHeight:1.3, marginBottom:3 }}>{a.title}</h3>
                        <div style={{ display:'flex', alignItems:'center', gap:5, color:'var(--gray-400)', fontSize:12 }}>
                          <BookOpen size={11}/> {a.subject}
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span className={STATUS_BADGE[a.status]||'badge badge-gray'}>{a.status}</span>
                        <div ref={menuOpen===a._id?menuRef:null} style={{ position:'relative' }}>
                          <button onClick={e=>{e.stopPropagation();setMenuOpen(menuOpen===a._id?null:a._id);}}
                            style={{ background:'none', border:'none', cursor:'pointer', padding:'3px 4px', color:'var(--gray-400)', borderRadius:6, display:'flex', transition:'color 0.12s' }}
                            onMouseEnter={e=>(e.currentTarget.style.color='var(--black)')}
                            onMouseLeave={e=>(e.currentTarget.style.color='var(--gray-400)')}>
                            <MoreVertical size={15}/>
                          </button>
                          {menuOpen===a._id&&(
                            <div className="slide-down" style={{ position:'absolute', right:0, top:'100%', zIndex:50, background:'#fff', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', minWidth:148, boxShadow:'var(--shadow-lg)', marginTop:4 }}>
                              {a.status==='completed'&&(
                                <div onClick={e=>{e.stopPropagation();router.push(`/output/${a._id}`);setMenuOpen(null);}}
                                  style={{ padding:'9px 14px', fontSize:13, cursor:'pointer', color:'var(--black)', transition:'background 0.1s' }}
                                  onMouseEnter={e=>(e.currentTarget.style.background='var(--gray-50)')}
                                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                                  View Assignment
                                </div>
                              )}
                              <div onClick={e=>handleDelete(a._id,e)}
                                style={{ padding:'9px 14px', fontSize:13, cursor:'pointer', color:'#DC2626', transition:'background 0.1s' }}
                                onMouseEnter={e=>(e.currentTarget.style.background='#FEF2F2')}
                                onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                                Delete
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:14, fontSize:12, color:'var(--gray-400)', flexWrap:'wrap' }}>
                      <span style={{ display:'flex', alignItems:'center', gap:3 }}><Calendar size={10}/> {format(new Date(a.createdAt),'dd-MM-yyyy')}</span>
                      <span>Due: {format(new Date(a.dueDate),'dd-MM-yyyy')}</span>
                      <span style={{ display:'flex', alignItems:'center', gap:3 }}><Hash size={10}/> {a.numberOfQuestions}Q · {a.totalMarks}M</span>
                    </div>
                    {a.status==='processing'&&(
                      <div style={{ marginTop:10 }}>
                        <div className="progress-bar"><div className="progress-fill" style={{ width:'65%', animation:'shimmer 1.5s infinite', background:'linear-gradient(90deg,#F97316,#FB923C,#F97316)', backgroundSize:'200% 100%' }}/></div>
                        <p style={{ fontSize:11, color:'#6366F1', marginTop:4, display:'flex', alignItems:'center', gap:4 }}><Loader2 size={10} className="spin"/> Generating...</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', justifyContent:'center', marginTop:20 }}>
                <Link href="/create"><button className="btn btn-primary">+ Create Assignment</button></Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
