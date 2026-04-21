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
}

export function MeritsAndQuotaSection({
  userId,
  communityIds,
  userRoles,
  expanded,
  onToggleExpanded,
  showLocalTeamGroups = true,
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
    <div className="bg-base-100 py-3 space-y-2">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="-mx-0.5 flex w-full items-center justify-between rounded-md px-0.5 py-0.5 transition-opacity hover:opacity-80"
        aria-expanded={expanded}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-base-content/45">
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
              <p className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-base-content/45">
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
    <div className="rounded-xl bg-base-200/25 p-3">
      <div className="flex gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Coins className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-sm font-semibold leading-tight text-base-content">
              {tCommon('sharedMerit')}
            </p>
            <p className="text-xl font-bold tabular-nums leading-none tracking-tight text-base-content sm:text-2xl">
              {formatMerits(balance)}
            </p>
          </div>
          <p className="text-[11px] leading-snug text-base-content/55 line-clamp-2">
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
