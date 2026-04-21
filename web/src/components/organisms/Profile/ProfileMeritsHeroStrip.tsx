'use client';

import { useTranslations } from 'next-intl';
import { formatMerits } from '@/lib/utils/currency';
import { useOtherUserWallet } from '@/hooks/api/useWallet';
import {
  useProfileMeritsLedgerModel,
  type ProfileMeritsLedgerRole,
} from '@/hooks/useProfileMeritsLedgerModel';
import { ProfileMeritHistoryLink } from '@/components/organisms/Profile/ProfileMeritHistoryLink';
import { cn } from '@/lib/utils';
import { useMeriterStitchChrome } from '@/contexts/MeriterChromeContext';

type Props = {
  userId: string;
  communityIds: string[];
  userRoles: ProfileMeritsLedgerRole[];
  /** Telemetry scope for merit-history link clicks. */
  profileActivityScope?: 'self' | 'other';
};

/**
 * Global merits + merit-history in the profile hero (paired with avatar in ProfileHero).
 */
export function ProfileMeritsHeroStrip({
  userId,
  communityIds,
  userRoles,
  profileActivityScope = 'self',
}: Props) {
  const sc = useMeriterStitchChrome();
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('profile');
  const { meritHistoryHref, showGlobalMeritBlock, walletCommunityId, showHeroMerits } =
    useProfileMeritsLedgerModel(userId, communityIds, userRoles);

  const { data: globalWallet, isPending: walletPending } = useOtherUserWallet(
    userId,
    walletCommunityId ?? '',
  );

  const historyClass = sc
    ? 'inline-flex max-w-full items-center gap-2 rounded-xl border border-stitch-accent/45 bg-transparent px-4 py-2.5 text-sm font-medium text-stitch-text transition-colors hover:bg-stitch-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-accent/40 sm:text-sm'
    : 'inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 sm:text-sm';

  if (!showHeroMerits) {
    return null;
  }

  const balance = globalWallet?.balance ?? 0;

  if (!showGlobalMeritBlock || !walletCommunityId) {
    return meritHistoryHref ? (
      <div className="flex w-full min-w-0 flex-col items-center gap-3 sm:items-start sm:text-left">
        <p
          className={cn(
            'text-[10px] font-bold uppercase tracking-widest',
            sc ? 'text-stitch-muted' : 'text-sm font-semibold text-base-content/70',
          )}
        >
          {sc ? tProfile('balanceSheetTitle') : tProfile('globalMeritsTitle')}
        </p>
        <ProfileMeritHistoryLink
          href={meritHistoryHref}
          className={historyClass}
          telemetryScope={profileActivityScope}
        />
      </div>
    ) : null;
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-2 sm:items-start sm:gap-2.5 sm:text-left">
      <p
        className={cn(
          sc ? 'text-[10px] font-bold uppercase tracking-widest text-stitch-muted' : 'text-sm font-semibold text-base-content/70',
        )}
      >
        {sc ? tProfile('balanceSheetTitle') : tProfile('globalMeritsTitle')}
      </p>
      <p
        className={cn(
          'text-3xl font-bold tabular-nums tracking-tight sm:text-4xl',
          sc ? 'text-stitch-text' : 'text-base-content',
          walletPending && (sc ? 'animate-pulse text-stitch-muted' : 'animate-pulse text-base-content/40'),
        )}
        aria-live="polite"
      >
        {walletPending ? '…' : formatMerits(balance)}
      </p>
      <p
        className={cn(
          'max-w-md text-xs leading-relaxed sm:text-sm',
          sc ? 'text-stitch-muted' : 'text-base-content/60',
        )}
      >
        {tCommon('sharedMeritUsedIn')}
      </p>
      {meritHistoryHref ? (
        <div className="pt-1">
          <ProfileMeritHistoryLink
            href={meritHistoryHref}
            className={historyClass}
            telemetryScope={profileActivityScope}
          />
        </div>
      ) : null}
    </div>
  );
}
