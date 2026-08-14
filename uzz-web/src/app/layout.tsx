import type { Metadata, Viewport } from 'next';
import { RuntimeConfigProvider } from '@/config/runtime-config-context';
import { readUzzRuntimeConfig } from '@/config/runtime-config';
import { TrpcProvider } from '@/lib/trpc/provider';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Услуги за заслуги',
  description: 'Обмен услугами за права из добрых дел сообщества',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const runtimeConfig = readUzzRuntimeConfig({
    NODE_ENV: process.env.NODE_ENV,
    API_URL: process.env.API_URL,
    UZZ_WEB_BASE_URL: process.env.UZZ_WEB_BASE_URL,
    DEFAULT_TELEGRAM_COMMUNITY_ID: process.env.DEFAULT_TELEGRAM_COMMUNITY_ID,
  });

  return (
    <html lang="ru" data-theme="dark">
      <body className="font-sans">
        <RuntimeConfigProvider value={runtimeConfig}>
          <TrpcProvider>{children}</TrpcProvider>
        </RuntimeConfigProvider>
      </body>
    </html>
  );
}
