'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/ui/Topbar';
import { useAssignmentStore } from '@/store/assignmentStore';
import { BookOpen, ExternalLink, Search, Pencil } from 'lucide-react';
import { format } from 'date-fns';

export default function LibraryPage() {
  const router = useRouter();
  const { assignments, fetchAssignments } = useAssignmentStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(()=>{ fetchAssignments().finally(()=>setLoading(false)); },[]);

  const completed = assignments.filter(a=>a.status==='completed'&&(a.title.toLowerCase().includes(search.toLowerCase())||a.subject.toLowerCase().includes(search.toLowerCase())));

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <Sidebar/>
      <main className="main-content" style={{ marginLeft:248, flex:1, minWidth:0 }}>
        <Topbar title="My Library"/>

        <div style={{ padding:'20px 28px' }}>
          <div className="fade-up" style={{ marginBottom:20 }}>
            <h1 style={{ fontSize:20, fontWeight:700, color:'var(--black)', marginBottom:3 }}>My Library</h1>
            <p style={{ fontSize:12, color:'var(--gray-400)' }}>All your completed question papers in one place.</p>
          </div>

          <div className="fade-up" style={{ position:'relative', marginBottom:20, maxWidth:360 }}>
            <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }}/>
            <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search papers..." style={{ paddingLeft:32 }}/>
          </div>

          {loading&&(
            <div className="stagger" style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[1,2,3].map(i=><div key={i} className="skeleton fade-up" style={{ height:64, borderRadius:10 }}/>)}
            </div>
          )}

          {!loading&&completed.length===0&&(
            <div className="card fade-up" style={{ padding:'60px 32px', textAlign:'center' }}>
              <div className="float" style={{ width:56, height:56, background:'var(--orange-dim)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <BookOpen size={22} color="#F97316"/>
              </div>
              <h2 style={{ fontSize:15, fontWeight:600, color:'var(--black)', marginBottom:6 }}>No saved papers</h2>
              <p style={{ color:'var(--gray-400)', fontSize:13, marginBottom:20 }}>Completed question papers will appear here automatically.</p>
              <Link href="/create"><button className="btn btn-primary">Create Assignment</button></Link>
            </div>
          )}

          {!loading&&completed.length>0&&(
            <div className="stagger" style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {completed.map(a=>(
                <div key={a._id} className="card card-hover fade-up" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:38, height:38, borderRadius:9, background:'var(--orange-dim)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'transform 0.2s' }}
                    onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.1) rotate(-5deg)')}
                    onMouseLeave={e=>(e.currentTarget.style.transform='none')}>
                    <BookOpen size={16} color="#F97316"/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:600, color:'var(--black)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.title}</p>
                    <p style={{ fontSize:12, color:'var(--gray-400)' }}>{a.subject} · {a.numberOfQuestions}Q · {a.totalMarks}M · {format(new Date(a.createdAt),'dd MMM yyyy')}</p>
                  </div>
                  <div style={{ display:'flex', gap:7, flexShrink:0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>router.push(`/output/${a._id}`)}>
                      <ExternalLink size={12}/> View
                    </button>
                    <button className="btn btn-sm" onClick={()=>router.push('/ai-toolkit')}
                      style={{ background:'var(--orange-dim)', border:'1px solid var(--orange-border)', color:'var(--orange)', fontWeight:600 }}
                      onMouseEnter={e=>(e.currentTarget.style.background='#FED7AA')}
                      onMouseLeave={e=>(e.currentTarget.style.background='var(--orange-dim)')}>
                      <Pencil size={12}/> Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
