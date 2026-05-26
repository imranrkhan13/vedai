import Link from 'next/link';
export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F7F7F8', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 56, fontWeight: 700, color: '#E5E7EB', marginBottom: 8 }}>404</div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>Page not found</h2>
      <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>This page does not exist.</p>
      <Link href="/home">
        <button style={{ padding: '9px 22px', background: '#1A1A1A', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          Go Home
        </button>
      </Link>
    </div>
  );
}
