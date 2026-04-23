'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const SCROLL_OPTS = { scroll: false as const };

export type CommunityHubFeedTab = 'posts' | 'projects' | 'events' | 'birzha';

const DEFAULT_VISIBLE: readonly CommunityHubFeedTab[] = [
  'posts',
  'projects',
  'events',
  'birzha',
];

const TAB_ORDER: readonly CommunityHubFeedTab[] = ['posts', 'projects', 'events', 'birzha'];

export function CommunityHubFeedTabBar({
  communityId: _communityId,
  visibleTabs = DEFAULT_VISIBLE,
  className,
}: {
  communityId: string;
  /** Subset of hub tabs (e.g. project hub omits «Проекты сообщества»). */
  visibleTabs?: readonly CommunityHubFeedTab[];
  /** When tabs sit inside the feed chrome card (no outer border / separate rounding). */
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('pages.communities');

  const visibleSet = new Set<CommunityHubFeedTab>(visibleTabs);
  const orderedTabs = TAB_ORDER.filter((id) => visibleSet.has(id));

  const KNOWN_NON_POST = new Set<string>(['projects', 'events', 'birzha']);
  const rawVal = searchParams?.get('feedTab');
  const unknownFeedTab = Boolean(rawVal && !KNOWN_NON_POST.has(rawVal));
  const parsed: CommunityHubFeedTab =
    rawVal && KNOWN_NON_POST.has(rawVal) ? (rawVal as CommunityHubFeedTab) : 'posts';
  const active: CommunityHubFeedTab = visibleSet.has(parsed) ? parsed : 'posts';

  useEffect(() => {
    if (!pathname) return;
    const sp = searchParams?.toString() ?? '';
    if (unknownFeedTab) {
      const p = new URLSearchParams(sp);
      p.delete('feedTab');
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, SCROLL_OPTS);
      return;
    }
    if (parsed === active) return;
    const p = new URLSearchParams(sp);
    if (active === 'posts') {
      p.delete('feedTab');
    } else {
      p.set('feedTab', active);
    }
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, SCROLL_OPTS);
  }, [active, parsed, pathname, router, searchParams, unknownFeedTab]);

  const setTab = (tab: CommunityHubFeedTab) => {
    if (!visibleSet.has(tab)) return;
    const p = new URLSearchParams(searchParams?.toString() ?? '');
    if (tab === 'posts') {
      p.delete('feedTab');
    } else {
      p.set('feedTab', tab);
    }
    const q = p.toString();
    const base = pathname ?? '';
    router.replace(q ? `${base}?${q}` : base, SCROLL_OPTS);
  };

  const labelFor = (id: CommunityHubFeedTab): string => {
    switch (id) {
      case 'posts':
        return t('feedTabPosts');
      case 'projects':
        return t('feedTabProjects');
      case 'events':
        return t('feedTabEvents');
      case 'birzha':
        return t('feedTabBirzha');
      default:
        return id;
    }
  };

  const n = orderedTabs.length;

  return (
    <div
      role="tablist"
      aria-label={t('feedTabListAria')}
      className={cn(
        'grid w-full gap-0.5 bg-base-200/35 p-1 dark:bg-base-200/25',
        className,
      )}
      style={{ gridTemplateColumns: n > 0 ? `repeat(${n}, minmax(0, 1fr))` : undefined }}
    >
      {orderedTabs.map((tab) => {
        const selected = active === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              'min-h-9 w-full rounded-lg px-1.5 py-1.5 text-center text-sm font-medium transition-colors sm:px-2',
              selected
                ? 'bg-base-100 text-base-content shadow-sm dark:bg-base-300/80'
                : 'text-base-content/70 hover:bg-base-300/40 hover:text-base-content',
            )}
            onClick={() => setTab(tab)}
          >
            <span className="line-clamp-2 leading-tight">{labelFor(tab)}</span>
          </button>
        );
      })}
    </div>
  );
}
