import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Njumeni — Global Legal Intelligence', template: '%s | Njumeni' },
  description: 'Law. Evidence. Intelligence. A structured legal intelligence workspace.',
  applicationName: 'Njumeni',
  metadataBase: new URL(process.env.APP_BASE_URL ?? 'http://localhost:3000'),
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
