import './globals.css';
import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';

const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'drop... — peer-to-peer file transfer',
  description: 'Send photos browser to browser over WebRTC. Nothing is uploaded.',
};

export const viewport: Viewport = { themeColor: '#0a0c0b' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable}>
      <body className="min-h-dvh bg-bg font-mono text-sm text-fg antialiased">
        <div className="relative z-10 mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8">
          <header className="mb-10 flex items-center justify-between">
            <span><span className="text-accent">↓</span> drop...</span>
            <span className="text-xs text-dim">p2p · encrypted · no uploads</span>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="mt-10 text-xs text-dim">
            files move browser → browser over WebRTC. nothing is stored.
          </footer>
        </div>
      </body>
    </html>
  );
}