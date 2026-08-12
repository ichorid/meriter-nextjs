'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CommunityIdBanner } from '@/components/community-id-banner';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Главная' },
  { href: '/catalog', label: 'Каталог' },
  { href: '/lots', label: 'Услуги' },
  { href: '/deals', label: 'Сделки' },
  { href: '/wallet', label: 'Кошелёк' },
  { href: '/deeds', label: 'Дела' },
  { href: '/profile', label: 'Профиль' },
  { href: '/admin', label: 'Админ' },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-stitch-canvas text-stitch-text">
      <CommunityIdBanner />
      <header className="sticky top-0 z-20 border-b border-stitch-border bg-stitch-sidebar/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-stitch-accent">
            Услуги за заслуги
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1">
            {NAV.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-stitch-accent/20 text-stitch-text'
                      : 'text-stitch-muted hover:bg-stitch-surface hover:text-stitch-text',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 safe-area-pb">{children}</main>
    </div>
  );
}
