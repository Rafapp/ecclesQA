import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Project Fantasia | Eccles School productivity tools',
  description: 'A web-based toolset for the Eccles School of Business Instructional Design Team.',
  icons: { icon: '/favicon.png' },
  openGraph: {
    title: 'Project Fantasia',
    description: 'A web-based toolset for the Eccles School of Business Instructional Design Team.',
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
