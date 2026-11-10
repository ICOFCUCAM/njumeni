import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Njumeni â Global Legal Intelligence', template: '%s | Njumeni' },
  description: 'Law. Evidence. Intelligence. A structured legal intelligence workspace.',
  applicationName: 'Njumeni',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
