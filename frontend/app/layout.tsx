import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import AuthGate from '@/components/AuthGate';

export const metadata: Metadata = {
  title: 'Quesly | From class notes to clear feedback',
  description: 'Create a paper from your notes, collect student answers, and review suggested marks before sharing results. Teachers stay in control with Quesly.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
