'use client';

import React, { useMemo } from 'react';
import { useCanViewUserMerits } from '@/hooks/useCanViewUserMerits';
import { UserCommunityMerits } from './UserCommunityMerits';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Coins } from 'lucide-react';
import { useOtherUserWallet } from '@/hooks/api/useWallet';
import { formatMerits } from '@/lib/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import { ProfileMeritHistoryLink } from '@/components/organisms/Profile/ProfileMeritHistoryLink';
import { cn } from '@/lib/utils';

const PRIORITY_TYPE_TAGS = ['marathon-of-good', 'future-vision', 'team-projects', 'support'] as const;

interface MeritsAndQuotaSectionProps {
  userId: string;
  communityIds: string[];
  userRoles: Array<{
    id: string;
    communityId: string;
    communityName?: string;
    communityTypeTag?: string;
    role: string;
  }>;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** When false, only global/priority merits block is shown (no "Team groups" list). Default true. */
  showLocalTeamGroups?: boolean;
  /** When used inside ProfileMeritsActivityPanel: skip outer card chrome */
  embedded?: boolean;
}

export function MeritsAndQuotaSection({
  userId,
  communityIds,
  userRoles,
  expanded,
  onToggleExpanded,
  showLocalTeamGroups = true,
  embedded = false,
}: MeritsAndQuotaSectionProps) {
  const tCommon = useTranslations('common');
  const tCommunities = useTranslations('communities');
  const { user: me } = useAuth();

  const { priorityRoles, localRoles } = useMemo(() => {
    const priority = userRoles.filter((r) => r.communityTypeTag && PRIORITY_TYPE_TAGS.includes(r.communityTypeTag as (typeof PRIORITY_TYPE_TAGS)[number]));
    const local = userRoles.filter((r) => !r.communityTypeTag || !PRIORITY_TYPE_TAGS.includes(r.communityTypeTag as (typeof PRIORITY_TYPE_TAGS)[number]));
    return { priorityRoles: priority, localRoles: local };
  }, [userRoles]);

  const hasPriority = priorityRoles.length > 0;
  const firstPriorityId = priorityRoles[0]?.communityId;
  const { canView: canViewGlobal } = useCanViewUserMerits(firstPriorityId ?? undefined);
  const hasLocal = localRoles.length > 0;

  const meritHistoryHref = useMemo(() => {
    if (!me?.id) return null;
    if (me.id === userId) {
      return routes.profileMeritTransfers;
    }
    if (me.globalRole === 'superadmin') {
      const ctx = firstPriorityId || communityIds[0] || 'viewer';
      return routes.userMeritHistory(userId, ctx);
    }
    if (hasPriority && canViewGlobal && firstPriorityId) {
      return routes.userMeritHistory(userId, firstPriorityId);
    }
    return null;
  }, [
    me?.id,
    me?.globalRole,
    userId,
    hasPriority,
    canViewGlobal,
    firstPriorityId,
    communityIds,
  ]);

  const showGlobalMeritBlock = Boolean(hasPriority && canViewGlobal && firstPriorityId);

  if (communityIds.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', !embedded && 'bg-base-100 py-3')}>
      <button
        type="button"
        onClick={onToggleExpanded}
        className="-mx-0.5 flex w-full items-center justify-between rounded-md px-0.5 py-0.5 transition-opacity hover:opacity-80"
        aria-expanded={expanded}
      >
        <p
          className={cn(
            'font-medium uppercase tracking-wide text-base-content/45',
            embedded ? 'text-[10px] sm:text-[11px]' : 'text-[11px]',
          )}
        >
          {tCommon('meritsAndQuota')}
        </p>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-base-content/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-base-content/40" />
        )}
      </button>
      {expanded && (
        <div className="animate-in fade-in duration-200 space-y-2.5">
          {meritHistoryHref && !showGlobalMeritBlock ? (
            <div className="flex justify-start pl-0.5">
              <ProfileMeritHistoryLink
                href={meritHistoryHref}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-base-content/10 bg-base-200/30 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/25 hover:bg-base-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
              />
            </div>
          ) : null}
          {showGlobalMeritBlock && firstPriorityId ? (
            <GlobalMeritBlock
              userId={userId}
              walletCommunityId={firstPriorityId}
              meritHistoryHref={meritHistoryHref ?? undefined}
            />
          ) : null}
          {showLocalTeamGroups && hasLocal && (
            <div className="space-y-1.5 pt-0.5">
              <p
                className={cn(
                  'px-0.5 font-medium uppercase tracking-wide text-base-content/45',
                  embedded ? 'text-[10px] sm:text-[11px]' : 'text-[11px]',
                )}
              >
                {tCommon('teamGroupsSection')}
              </p>
              <div className="space-y-1.5">
                {localRoles.map((role) => (
                  <CommunityMeritsWrapper
                    key={role.communityId}
                    userId={userId}
                    communityId={role.communityId}
                    communityName={role.communityTypeTag === 'team-projects' ? tCommunities('teamGroupsName') : role.communityName}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GlobalMeritBlock({
  userId,
  walletCommunityId,
  meritHistoryHref,
}: {
  userId: string;
  walletCommunityId: string;
  meritHistoryHref?: string;
}) {
  const tCommon = useTranslations('common');
  const { data: globalWallet } = useOtherUserWallet(userId, walletCommunityId);

  const balance = globalWallet?.balance ?? 0;

  return (
    <div className="rounded-xl border border-base-300/30 bg-base-200/20 p-2.5 sm:border-base-300/40 sm:bg-base-200/25 sm:p-3">
      <div className="flex gap-2 sm:gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary sm:h-9 sm:w-9">
          <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 sm:gap-x-3">
            <p className="text-xs font-semibold leading-tight text-base-content sm:text-sm">
              {tCommon('sharedMerit')}
            </p>
            <p className="text-lg font-bold tabular-nums leading-none tracking-tight text-base-content sm:text-xl md:text-2xl">
              {formatMerits(balance)}
            </p>
          </div>
          <p className="text-[10px] leading-snug text-base-content/55 line-clamp-2 sm:text-[11px]">
            {tCommon('sharedMeritUsedIn')}
          </p>
          {meritHistoryHref ? (
            <div className="pt-0.5">
              <ProfileMeritHistoryLink href={meritHistoryHref} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CommunityMeritsWrapper({
  userId,
  communityId,
  communityName,
}: {
  userId: string;
  communityId: string;
  communityName?: string;
}) {
  const { canView } = useCanViewUserMerits(communityId);

  if (!canView) return null;

  return (
    <UserCommunityMerits
      userId={userId}
      communityId={communityId}
      communityName={communityName}
      canView={canView}
    />
  );
}
