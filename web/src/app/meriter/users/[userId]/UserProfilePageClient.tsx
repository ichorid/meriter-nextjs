'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useProfileActivityCounts, useUserProfile } from '@/hooks/api/useUsers';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useInvitableCommunities } from '@/hooks/api/useTeams';
import { useAuth } from '@/contexts/AuthContext';
import { User as UserIcon, UserPlus } from 'lucide-react';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { ProfileHero } from '@/components/organisms/Profile/ProfileHero';
import { InviteToTeamDialog } from '@/components/organisms/Profile/InviteToTeamDialog';
import { ProfileContentCards } from '@/components/organisms/Profile/ProfileContentCards';
import { ProfileMeritsActivityPanel } from '@/components/organisms/Profile/ProfileMeritsActivityPanel';
import { ProfileMeritsHeroStrip } from '@/components/organisms/Profile/ProfileMeritsHeroStrip';
import { CommunityCard } from '@/components/organisms/CommunityCard';
import { Button } from '@/components/ui/shadcn/button';
import { MeritTransferButton } from '@/features/merit-transfer';
import { buildProfileMeritTransferContext } from '@/features/merit-transfer/lib/profile-merit-transfer-context';
import { getProfileLayoutBand, trackMeriterUiEvent } from '@/lib/telemetry/meriter-ui-telemetry';
import { useMeriterStitchChrome } from '@/contexts/MeriterChromeContext';
import { cn } from '@/lib/utils';

const PRIORITY_TYPE_TAGS = ['marathon-of-good', 'future-vision', 'team-projects', 'support'] as const;

function isPriorityTypeTag(tag: string | undefined): boolean {
  return !!tag && PRIORITY_TYPE_TAGS.includes(tag as (typeof PRIORITY_TYPE_TAGS)[number]);
}

export function UserProfilePageClient({ userId }: { userId: string }) {
  const sc = useMeriterStitchChrome();
  const router = useRouter();
  const pathname = usePathname();
  const tCommon = useTranslations('common');
  const tCommunities = useTranslations('communities');
  const tProfile = useTranslations('profile');
  const { user: authUser, isAuthenticated } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: user, isLoading, error, isFetched } = useUserProfile(userId);
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles(userId);
  const { data: activityCounts, isLoading: activityCountsLoading } = useProfileActivityCounts(userId);

  const viewingOtherProfile =
    isAuthenticated && !!authUser?.id && authUser.id !== userId;

  const { data: viewerRoles = [] } = useUserRoles(
    viewingOtherProfile ? authUser!.id : '',
  );

  const { data: invitableCommunities = [] } = useInvitableCommunities(
    viewingOtherProfile ? userId : '',
  );

  // Handle 404 - redirect to not-found if user doesn't exist
  useEffect(() => {
    if (isFetched && !isLoading) {
      const isNotFound =
        error &&
        ((error as { data?: { code?: string }; message?: string })?.data?.code === 'NOT_FOUND' ||
          (typeof (error as { message?: string })?.message === 'string' &&
            (error as { message: string }).message.includes('not found')));

      if (isNotFound) {
        router.replace('/meriter/not-found');
      }
    }
  }, [isFetched, isLoading, error, router]);

  const communityIds = useMemo(() => {
    return Array.from(new Set(userRoles.map((r) => r.communityId).filter(Boolean))) as string[];
  }, [userRoles]);

  const profileMeritTransfer = useMemo(
    () =>
      viewingOtherProfile
        ? buildProfileMeritTransferContext(viewerRoles, userRoles)
        : null,
    [viewingOtherProfile, viewerRoles, userRoles],
  );

  useEffect(() => {
    if (!user?.id || isLoading) return;
    if (viewingOtherProfile) {
      trackMeriterUiEvent({
        name: 'profile_view_other',
        payload: { targetUserId: user.id, layout: getProfileLayoutBand() },
      });
    } else {
      trackMeriterUiEvent({ name: 'profile_view_self', payload: { layout: getProfileLayoutBand() } });
    }
  }, [user?.id, isLoading, viewingOtherProfile]);

  const administeredCommunityIds = useMemo(() => {
    return Array.from(
      new Set(
        userRoles
          .filter(
            (r) =>
              r.role === 'lead' &&
              !isPriorityTypeTag(r.communityTypeTag) &&
              r.communityTypeTag !== 'project'
          )
          .map((r) => r.communityId)
          .filter(Boolean)
      )
    ) as string[];
  }, [userRoles]);

  const memberCommunityIds = useMemo(() => {
    return Array.from(
      new Set(
        userRoles
          .filter(
            (r) =>
              r.role !== 'lead' &&
              !isPriorityTypeTag(r.communityTypeTag) &&
              r.communityTypeTag !== 'project'
          )
          .map((r) => r.communityId)
          .filter(Boolean)
      )
    ) as string[];
  }, [userRoles]);

  const administeredProjectIds = useMemo(() => {
    return Array.from(
      new Set(
        userRoles
          .filter((r) => r.role === 'lead' && r.communityTypeTag === 'project')
          .map((r) => r.communityId)
          .filter(Boolean)
      )
    ) as string[];
  }, [userRoles]);

  const memberProjectIds = useMemo(() => {
    return Array.from(
      new Set(
        userRoles
          .filter((r) => r.role !== 'lead' && r.communityTypeTag === 'project')
          .map((r) => r.communityId)
          .filter(Boolean)
      )
    ) as string[];
  }, [userRoles]);

  const userRolesForMerits = useMemo(
    () =>
      userRoles.map((r) => ({
        id: r.id || '',
        communityId: r.communityId || '',
        communityName: r.communityName,
        communityTypeTag: r.communityTypeTag,
        role: r.role,
      })),
    [userRoles]
  );

  const activityStats = useMemo(
    () => ({
      publications: activityCounts?.publications ?? 0,
      comments: activityCounts?.comments ?? 0,
      polls: activityCounts?.polls ?? 0,
    }),
    [activityCounts]
  );

  if (isLoading) {
    return (
      <AdaptiveLayout
        stickyHeader={
          <SimpleStickyHeader title={tCommon('userProfile')} showBack={true} asStickyHeader={true} showScrollToTop={true} />
        }
      >
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </AdaptiveLayout>
    );
  }

  if (error || !user) {
    return (
      <AdaptiveLayout
        stickyHeader={
          <SimpleStickyHeader title={tCommon('userProfile')} showBack={true} asStickyHeader={true} showScrollToTop={true} />
        }
      >
        <div className="text-center py-12 text-base-content/60">
          <UserIcon className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
          <p className="font-medium">{tCommon('userNotFound')}</p>
          <p className="text-sm mt-1">{tCommon('userNotFoundDescription')}</p>
        </div>
      </AdaptiveLayout>
    );
  }

  const displayName = user.displayName || user.username || tCommon('user');

  const profileHeroFooterBtnClass = sc
    ? 'inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-0 bg-white/[0.06] px-3 text-sm font-medium text-stitch-text shadow-none transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-accent/35 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0'
    : 'inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-base-300/50 bg-base-200/60 px-3 text-sm font-medium text-base-content transition-colors hover:bg-base-300/70 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0';

  return (
    <AdaptiveLayout
      stickyHeader={
        <SimpleStickyHeader title={tCommon('userProfile')} showBack={true} asStickyHeader={true} showScrollToTop={true} />
      }
    >
      <div className={cn('space-y-6', sc && 'text-stitch-text')}>
        <ProfileHero
          user={user}
          showEdit={false}
          userRoles={userRoles}
          meritsHeroSlot={
            <ProfileMeritsHeroStrip
              userId={user.id}
              communityIds={communityIds}
              userRoles={userRolesForMerits}
              profileActivityScope={viewingOtherProfile ? 'other' : 'self'}
            />
          }
          meritsHeroFooterSlot={
            viewingOtherProfile ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={profileHeroFooterBtnClass}
                    aria-label={tProfile('inviteUserProfileButton')}
                    onClick={() => {
                      trackMeriterUiEvent({ name: 'profile_invite_open' });
                      setInviteOpen(true);
                    }}
                  >
                    <UserPlus className="shrink-0" />
                    {tProfile('inviteUserProfileButton')}
                  </Button>
                  {profileMeritTransfer ? (
                    <MeritTransferButton
                      receiverId={user.id}
                      receiverDisplayName={displayName}
                      profileContext={profileMeritTransfer}
                      variant="ghost"
                      size="sm"
                      onOpenDialog={() => trackMeriterUiEvent({ name: 'profile_merit_transfer_open' })}
                      className={profileHeroFooterBtnClass}
                    />
                  ) : null}
                </div>
                <InviteToTeamDialog
                  open={inviteOpen}
                  onClose={() => setInviteOpen(false)}
                  targetUserId={user.id}
                  communities={invitableCommunities}
                />
              </>
            ) : null
          }
        />

        <div>
          <div
            className={cn(
              'mt-1 overflow-hidden rounded-2xl border-0',
              sc ? 'bg-stitch-surface shadow-none' : 'bg-base-200/20 shadow-none',
            )}
          >
            <ProfileMeritsActivityPanel
              activitySlot={
                <ProfileContentCards
                  stats={activityStats}
                  isLoading={activityCountsLoading}
                  activityForUserId={user.id}
                  embedded
                />
              }
            />
          </div>
        </div>

        <div>
          <div
            className={cn(
              'mt-1 space-y-4 overflow-hidden rounded-2xl border-0 px-0 py-4',
              sc ? 'bg-stitch-surface shadow-none' : 'bg-base-200/20 shadow-none',
            )}
          >
            <p
              className={cn(
                'text-xs font-medium uppercase tracking-wide',
                sc ? 'text-stitch-muted' : 'text-base-content/40',
              )}
            >
              {tCommunities('administeredCommunities')}
            </p>
            {rolesLoading ? (
              <div className="flex flex-col gap-1">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : administeredCommunityIds.length > 0 ? (
              <div className="flex flex-col gap-2">
                {administeredCommunityIds.map((communityId) => (
                  <CommunityCard
                    key={communityId}
                    communityId={communityId}
                    pathname={pathname}
                    isExpanded={true}
                    compact={sc}
                  />
                ))}
              </div>
            ) : (
              <p className={cn('text-sm', sc ? 'text-stitch-muted' : 'text-base-content/50')}>
                {tCommunities('noAdministeredCommunitiesOther', { name: displayName })}
              </p>
            )}

            <p
              className={cn(
                'text-xs font-medium uppercase tracking-wide',
                sc ? 'text-stitch-muted' : 'text-base-content/40',
              )}
            >
              {tCommunities('communitiesIMemberOf')}
            </p>
            {rolesLoading ? (
              <div className="flex flex-col gap-1">
                <CardSkeleton />
              </div>
            ) : memberCommunityIds.length > 0 ? (
              <div className="flex flex-col gap-2">
                {memberCommunityIds.map((communityId) => (
                  <CommunityCard
                    key={communityId}
                    communityId={communityId}
                    pathname={pathname}
                    isExpanded={true}
                    compact={sc}
                  />
                ))}
              </div>
            ) : (
              <p className={cn('text-sm', sc ? 'text-stitch-muted' : 'text-base-content/50')}>
                {tCommunities('noMemberCommunitiesOther', { name: displayName })}
              </p>
            )}

            <p
              className={cn(
                'text-xs font-medium uppercase tracking-wide',
                sc ? 'text-stitch-muted' : 'text-base-content/40',
              )}
            >
              {tCommunities('administeredProjects')}
            </p>
            {rolesLoading ? (
              <div className="flex flex-col gap-1">
                <CardSkeleton />
              </div>
            ) : administeredProjectIds.length > 0 ? (
              <div className="flex flex-col gap-2">
                {administeredProjectIds.map((communityId) => (
                  <CommunityCard
                    key={communityId}
                    communityId={communityId}
                    pathname={pathname}
                    isExpanded={true}
                    compact={sc}
                  />
                ))}
              </div>
            ) : (
              <p className={cn('text-sm', sc ? 'text-stitch-muted' : 'text-base-content/50')}>
                {tCommunities('noAdministeredProjectsOther', { name: displayName })}
              </p>
            )}

            <p
              className={cn(
                'text-xs font-medium uppercase tracking-wide',
                sc ? 'text-stitch-muted' : 'text-base-content/40',
              )}
            >
              {tCommunities('memberProjects')}
            </p>
            {rolesLoading ? (
              <div className="flex flex-col gap-1">
                <CardSkeleton />
              </div>
            ) : memberProjectIds.length > 0 ? (
              <div className="flex flex-col gap-2">
                {memberProjectIds.map((communityId) => (
                  <CommunityCard
                    key={communityId}
                    communityId={communityId}
                    pathname={pathname}
                    isExpanded={true}
                    compact={sc}
                  />
                ))}
              </div>
            ) : (
              <p className={cn('text-sm', sc ? 'text-stitch-muted' : 'text-base-content/50')}>
                {tCommunities('noMemberProjectsOther', { name: displayName })}
              </p>
            )}
          </div>
        </div>
      </div>
    </AdaptiveLayout>
  );
}
