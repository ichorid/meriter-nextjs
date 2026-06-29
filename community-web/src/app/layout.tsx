import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { TrpcProvider } from '@/lib/trpc/provider';
import { TelegramMiniAppProvider } from '@/lib/telegram-mini-app-context';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'Meriter — сообщество',
  description: 'Заслуги вашего Telegram-сообщества',
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
        <TrpcProvider>
          <TelegramMiniAppProvider>{children}</TelegramMiniAppProvider>
        </TrpcProvider>
      </body>
    </html>
  );
}
