'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { History } from 'lucide-react';

type ProfileMeritHistoryLinkProps = {
  href: string;
  className?: string;
};

/**
 * Compact link to the global-wallet merit ledger (own or another user with permission).
 */
export function ProfileMeritHistoryLink({ href, className }: ProfileMeritHistoryLinkProps) {
  const t = useTranslations('meritHistory');

  return (
    <Link
      href={href}
      className={
        className ??
        'inline-flex max-w-full items-center gap-2 rounded-lg border border-base-300 bg-base-200/40 px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/40 hover:bg-base-200/80'
      }
    >
      <History className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <span className="min-w-0 truncate">{t('openFullHistoryLink')}</span>
    </Link>
  );
}
