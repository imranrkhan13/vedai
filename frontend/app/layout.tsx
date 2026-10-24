import type { Metadata } from 'next';
import {siteUrl,siteDescription} from '@/lib/seo';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import AuthGate from '@/components/AuthGate';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {default:'Quesly | AI Question Papers & Teacher-Reviewed Grading',template:'%s | Quesly'},
  description: siteDescription,
  applicationName:'Quesly',
  robots:{index:false,follow:false},
  openGraph:{type:'website',siteName:'Quesly',locale:'en_US',title:'Quesly — More room for teaching',description:siteDescription,images:[{url:'/opengraph-image',width:1200,height:630,alt:'Quesly: Your notes. Better questions. Your final say.'}]},
  twitter:{card:'summary_large_image',title:'Quesly — More room for teaching',description:siteDescription,images:['/opengraph-image']},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthGate>{children}</AuthGate>
        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#fff', color: '#1A1A1A',
            border: '1px solid #E5E7EB', borderRadius: '10px',
            fontSize: '13px', fontFamily: 'Bricolage Grotesque, sans-serif',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          },
        }} />
      </body>
    </html>
  );
}
