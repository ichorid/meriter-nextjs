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
    <div className="bg-base-100 py-4 space-y-3">
      <button
        onClick={onToggleExpanded}
        className="flex items-center justify-between w-full hover:opacity-80 transition-opacity rounded-lg -mx-1 px-1 py-0.5"
        aria-expanded={expanded}
      >
        <p className="text-xs font-medium text-base-content/50 uppercase tracking-wide">
          {tCommon('meritsAndQuota')}
        </p>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-base-content/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-base-content/40" />
        )}
      </button>
      {expanded && (
        <div className="animate-in fade-in duration-200 space-y-4">
          {meritHistoryHref && !showGlobalMeritBlock ? (
            <div className="flex justify-start">
              <ProfileMeritHistoryLink href={meritHistoryHref} />
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
            <div className="space-y-2">
              <p className="text-xs font-medium text-base-content/50 uppercase tracking-wide px-0.5">
                {tCommon('teamGroupsSection')}
              </p>
              <div className="space-y-2">
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
    <div className="rounded-xl border border-base-200 bg-gradient-to-br from-base-100 to-base-200/50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Coins className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-base-content">{tCommon('sharedMerit')}</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-base-content">
            {formatMerits(balance)}
          </p>
          <p className="mt-2 text-xs text-base-content/60">
            {tCommon('sharedMeritUsedIn')}
          </p>
          {meritHistoryHref ? (
            <div className="mt-3 border-t border-base-300/50 pt-3">
              <ProfileMeritHistoryLink
                href={meritHistoryHref}
                className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-base-200/50 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-base-200"
              />
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
