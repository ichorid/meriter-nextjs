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
              <ProfileMeritHistoryLink href={meritHistoryHref} />
            </div>
          ) : null}
          {showGlobalMeritBlock && firstPriorityId ? (
            <GlobalMeritBlock
              userId={userId}
              walletCommunityId={firstPriorityId}
              meritHistoryHref={meritHistoryHref ?? undefined}
              flat={embedded}
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
  flat = false,
}: {
  userId: string;
  walletCommunityId: string;
  meritHistoryHref?: string;
  /** No inner card frame — aligns with ProfileMeritsActivityPanel */
  flat?: boolean;
}) {
  const tCommon = useTranslations('common');
  const { data: globalWallet } = useOtherUserWallet(userId, walletCommunityId);

  const balance = globalWallet?.balance ?? 0;

  const body = (
    <div className="flex gap-2.5 sm:gap-3">
      <div
        className={cn(
          'flex shrink-0 items-center justify-center bg-primary/10 text-primary',
          flat ? 'h-9 w-9 rounded-md sm:h-10 sm:w-10' : 'h-9 w-9 rounded-lg bg-primary/12 sm:h-10 sm:w-10',
        )}
      >
        <Coins className="h-4 w-4 sm:h-[1.05rem] sm:w-[1.05rem]" aria-hidden />
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
  );

  if (flat) {
    return <div className="py-0.5">{body}</div>;
  }

  return (
    <div className="rounded-lg bg-base-200/25 p-3 sm:p-3.5 dark:bg-base-200/20">{body}</div>
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
