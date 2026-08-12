import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { TrpcProvider } from '@/lib/trpc/provider';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'Услуги за заслуги',
  description: 'Обмен услугами и товарами за банки из добрых дел',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" data-theme="dark">
      <body className={`${manrope.variable} font-sans`}>
        <TrpcProvider>{children}</TrpcProvider>
      </body>
    </html>
  );
}
