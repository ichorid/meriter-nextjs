'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { History } from 'lucide-react';

import { trackMeriterUiEvent } from '@/lib/telemetry/meriter-ui-telemetry';

type ProfileMeritHistoryLinkProps = {
  href: string;
  /** Defaults to a compact text-style link; pass a class for a stronger row (e.g. empty merits strip). */
  className?: string;
  /** For client telemetry only (PRD profile-redesign). */
  telemetryScope?: 'self' | 'other';
};

const defaultClassName =
  'inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-base-100';

/**
 * Link to the global-wallet merit ledger (own or another user with permission).
 */
export function ProfileMeritHistoryLink({
  href,
  className,
  telemetryScope = 'self',
}: ProfileMeritHistoryLinkProps) {
  const t = useTranslations('meritHistory');

  return (
    <Link
      href={href}
      className={className ?? defaultClassName}
      onClick={() =>
        trackMeriterUiEvent({
          name: 'profile_merit_history_open',
          payload: { scope: telemetryScope },
        })
      }
    >
      <History className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      <span className="min-w-0 truncate">{t('openFullHistoryLink')}</span>
    </Link>
  );
}
