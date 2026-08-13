import type { Metadata, Viewport } from 'next';
import { TrpcProvider } from '@/lib/trpc/provider';
import './globals.css';
export const metadata: Metadata = { title: 'Услуги за заслуги', description: 'Обмен услугами за права из добрых дел сообщества' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0f172a' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ru" data-theme="dark"><body className="font-sans"><TrpcProvider>{children}</TrpcProvider></body></html>; }
