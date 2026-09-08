import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://resumeos-jd-first.ghs-srm-2022.chatgpt.site'),
  title: 'ResumeOS — Resume Operations',
  description: 'JD-first resume operations for teams and a transparent read-only candidate experience.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'ResumeOS — JD-first resume operations',
    description: 'Full-control admin operations and a clear, read-only candidate portal.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'ResumeOS — JD-first resume operations, made clear.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ResumeOS — JD-first resume operations',
    description: 'Full-control admin operations and a clear, read-only candidate portal.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
