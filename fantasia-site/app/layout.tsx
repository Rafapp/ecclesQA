import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Project Fantasia | Eccles School productivity tools',
  description: 'Install and learn about Wand, Magic, and Sorcerer—focused productivity tools for accessibility review and repeatable work.',
  icons: { icon: '/favicon.png' },
  openGraph: {
    title: 'Project Fantasia',
    description: 'Install Wand and Magic, and follow the development of Sorcerer.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
