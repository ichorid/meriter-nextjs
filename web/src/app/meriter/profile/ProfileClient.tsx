'use client';

import React, { useState, useMemo, memo, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, useMeritStats } from '@/hooks/api/useProfile';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { ProfileEditForm } from '@/components/organisms/Profile/ProfileEditForm';
import { ProfileHero } from '@/components/organisms/Profile/ProfileHero';
import { ProfileStats } from '@/components/organisms/Profile/ProfileStats';
import { ProfileContentCards } from '@/components/organisms/Profile/ProfileContentCards';
import { useProfileData } from '@/hooks/useProfileData';
import { MeritsAndQuotaSection } from '@/app/meriter/users/[userId]/MeritsAndQuotaSection';
import { ProfileMeritHistoryLink } from '@/components/organisms/Profile/ProfileMeritHistoryLink';
import { ProfileMeritsActivityPanel } from '@/components/organisms/Profile/ProfileMeritsActivityPanel';
import { routes } from '@/lib/constants/routes';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from '@/components/ui/shadcn/button';
import { Separator } from '@/components/ui/shadcn/separator';
import { CommunityCard } from '@/components/organisms/CommunityCard';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Loader2, Plus } from 'lucide-react';

function ProfilePageComponent() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const tCommunities = useTranslations('communities');
  const { user, isLoading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const { data: roles } = useUserRoles(user?.id || '');
  const [meritsExpanded, setMeritsExpanded] = useLocalStorage<boolean>('profile.meritsExpanded', true);

  const { communities: allCommunities, walletsMap, quotasMap, isLoading: communitiesLoading } = useUserCommunities();

  // Private communities only (no special: future-vision, marathon-of-good, team-projects, support)
  const userCommunities = useMemo(
    () =>
      allCommunities.filter(
        (c) =>
          c.typeTag !== 'future-vision' &&
          c.typeTag !== 'marathon-of-good' &&
          c.typeTag !== 'team-projects' &&
          c.typeTag !== 'support'
      ),
    [allCommunities]
  );

  const leadCommunityIds = useMemo(
    () => new Set((roles || []).filter((r) => r.role === 'lead').map((r) => r.communityId)),
    [roles]
  );

  const communitiesOnly = useMemo(
    () => userCommunities.filter((c) => !c.isProject),
    [userCommunities]
  );
  const projectsOnly = useMemo(
    () => userCommunities.filter((c) => c.isProject === true),
    [userCommunities]
  );

  const administeredCommunities = useMemo(
    () => communitiesOnly.filter((c) => leadCommunityIds.has(c.id)),
    [communitiesOnly, leadCommunityIds]
  );
  const memberCommunities = useMemo(
    () => communitiesOnly.filter((c) => !leadCommunityIds.has(c.id)),
    [communitiesOnly, leadCommunityIds]
  );
  const administeredProjects = useMemo(
    () => projectsOnly.filter((c) => leadCommunityIds.has(c.id)),
    [projectsOnly, leadCommunityIds]
  );
  const memberProjects = useMemo(
    () => projectsOnly.filter((c) => !leadCommunityIds.has(c.id)),
    [projectsOnly, leadCommunityIds]
  );

  // Get unique community IDs from user roles (for MeritsAndQuotaSection)
  const communityIds = useMemo(() => {
    if (!roles) return [];
    return Array.from(new Set(roles.map(role => role.communityId).filter(Boolean)));
  }, [roles]);

  // Get profile content data for cards
  const {
    myPublications,
    publicationsLoading,
    myComments,
    commentsLoading,
    myPolls,
    pollsLoading,
    favoritesCount,
  } = useProfileData();

  const { data: meritStatsData, isLoading: meritStatsLoading } = useMeritStats();

  // Memoize computed values to prevent unnecessary re-renders
  const totalMerits = useMemo(() => {
    return meritStatsData?.meritStats?.reduce((sum, stat) => sum + stat.amount, 0) || 0;
  }, [meritStatsData?.meritStats]);

  // Memoize hero stats object to prevent new reference on every render
  const heroStats = useMemo(() => ({
    merits: totalMerits,
  }), [totalMerits]);

  // Memoize content cards stats object
  const contentCardsStats = useMemo(() => ({
    publications: myPublications.length,
    comments: myComments.length,
    polls: myPolls.length,
    favorites: favoritesCount,
  }), [myPublications.length, myComments.length, myPolls.length, favoritesCount]);

  // Memoize loading state for content cards
  const contentCardsLoading = useMemo(() =>
    publicationsLoading || commentsLoading || pollsLoading,
    [publicationsLoading, commentsLoading, pollsLoading]
  );

  // Memoize roles array to prevent new reference
  const userRolesArray = useMemo(() => roles || [], [roles]);

  // Memoize callbacks to prevent new function references on every render
  const handleEdit = useCallback(() => setIsEditing(true), []);
  const handleCancelEdit = useCallback(() => setIsEditing(false), []);
  const handleSuccessEdit = useCallback(() => setIsEditing(false), []);

  if (authLoading) {
    return (
      <AdaptiveLayout>
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </AdaptiveLayout>
    );
  }

  if (!user) {
    return (
      <AdaptiveLayout>
        <div className="p-4">
          <p className="text-brand-text-secondary">{t('notFound')}</p>
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout>
      <div className="space-y-0">
        {/* Profile Hero Section */}
        {isEditing ? (
          <div className="w-full">
            <ProfileEditForm
              onCancel={handleCancelEdit}
              onSuccess={handleSuccessEdit}
            />
          </div>
        ) : (
          <ProfileHero
            user={user}
            stats={heroStats}
            onEdit={handleEdit}
            showEdit={true}
            userRoles={userRolesArray}
          />
        )}

        {/* Merit Statistics */}
        {meritStatsData?.meritStats && meritStatsData.meritStats.length > 0 && (
          <div className="mt-6">
            <ProfileStats
              meritStats={meritStatsData.meritStats}
              isLoading={meritStatsLoading}
            />
          </div>
        )}

        {/* Merits + activity — full width like ProfileHero (no extra horizontal inset) */}
        <div>
          <Separator className="bg-base-300" />
          <ProfileMeritsActivityPanel
            meritsSlot={
              communityIds.length > 0 ? (
                <MeritsAndQuotaSection
                  userId={user.id}
                  communityIds={communityIds}
                  userRoles={userRolesArray.map((role) => ({
                    id: role.id || '',
                    communityId: role.communityId || '',
                    communityName: role.communityName,
                    communityTypeTag: role.communityTypeTag,
                    role: role.role,
                  }))}
                  expanded={meritsExpanded}
                  onToggleExpanded={() => setMeritsExpanded(!meritsExpanded)}
                  showLocalTeamGroups={false}
                  embedded
                />
              ) : (
                <div className="flex justify-start py-0.5">
                  <ProfileMeritHistoryLink href={routes.profileMeritTransfers} />
                </div>
              )
            }
            activitySlot={
              <ProfileContentCards
                stats={contentCardsStats}
                isLoading={contentCardsLoading}
                embedded
              />
            }
          />
        </div>

        {/* My communities: administered + create + member */}
        <div>
          <Separator className="bg-base-300" />
          <div className="bg-base-100 py-4 space-y-4">
            <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-4">
              {tCommunities('administeredCommunities')}
            </p>
            {communitiesLoading ? (
              <div className="flex flex-col gap-1 px-4">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : administeredCommunities.length > 0 ? (
              <div className="flex flex-col gap-1 px-4">
                {administeredCommunities.map((community) => {
                  const wallet = walletsMap.get(community.id);
                  const quota = quotasMap.get(community.id);
                  return (
                    <CommunityCard
                      key={community.id}
                      communityId={community.id}
                      pathname={pathname}
                      isExpanded={true}
                      wallet={wallet ? { balance: wallet.balance || 0, communityId: community.id } : undefined}
                      quota={
                        quota && typeof quota.remainingToday === 'number'
                          ? { remainingToday: quota.remainingToday, dailyQuota: quota.dailyQuota ?? 0 }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-base-content/50 px-4">{tCommunities('noAdministeredCommunities')}</p>
            )}

            <div className="px-4">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => router.push('/meriter/communities/create')}
              >
                <Plus className="w-4 h-4" />
                {tCommon('createCommunity')}
              </Button>
            </div>

            <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-4">
              {tCommunities('communitiesIMemberOf')}
            </p>
            {communitiesLoading ? (
              <div className="flex flex-col gap-1 px-4">
                <CardSkeleton />
              </div>
            ) : memberCommunities.length > 0 ? (
              <div className="flex flex-col gap-1 px-4">
                {memberCommunities.map((community) => {
                  const wallet = walletsMap.get(community.id);
                  const quota = quotasMap.get(community.id);
                  return (
                    <CommunityCard
                      key={community.id}
                      communityId={community.id}
                      pathname={pathname}
                      isExpanded={true}
                      wallet={wallet ? { balance: wallet.balance || 0, communityId: community.id } : undefined}
                      quota={
                        quota && typeof quota.remainingToday === 'number'
                          ? { remainingToday: quota.remainingToday, dailyQuota: quota.dailyQuota ?? 0 }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-base-content/50 px-4">{tCommunities('noMemberCommunities')}</p>
            )}

            <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-4">
              {tCommunities('administeredProjects')}
            </p>
            {communitiesLoading ? (
              <div className="flex flex-col gap-1 px-4">
                <CardSkeleton />
              </div>
            ) : administeredProjects.length > 0 ? (
              <div className="flex flex-col gap-1 px-4">
                {administeredProjects.map((community) => {
                  const wallet = walletsMap.get(community.id);
                  const quota = quotasMap.get(community.id);
                  return (
                    <CommunityCard
                      key={community.id}
                      communityId={community.id}
                      pathname={pathname}
                      isExpanded={true}
                      wallet={wallet ? { balance: wallet.balance || 0, communityId: community.id } : undefined}
                      quota={
                        quota && typeof quota.remainingToday === 'number'
                          ? { remainingToday: quota.remainingToday, dailyQuota: quota.dailyQuota ?? 0 }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-base-content/50 px-4">{tCommunities('noAdministeredProjects')}</p>
            )}

            <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-4">
              {tCommunities('memberProjects')}
            </p>
            {communitiesLoading ? (
              <div className="flex flex-col gap-1 px-4">
                <CardSkeleton />
              </div>
            ) : memberProjects.length > 0 ? (
              <div className="flex flex-col gap-1 px-4">
                {memberProjects.map((community) => {
                  const wallet = walletsMap.get(community.id);
                  const quota = quotasMap.get(community.id);
                  return (
                    <CommunityCard
                      key={community.id}
                      communityId={community.id}
                      pathname={pathname}
                      isExpanded={true}
                      wallet={wallet ? { balance: wallet.balance || 0, communityId: community.id } : undefined}
                      quota={
                        quota && typeof quota.remainingToday === 'number'
                          ? { remainingToday: quota.remainingToday, dailyQuota: quota.dailyQuota ?? 0 }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-base-content/50 px-4">{tCommunities('noMemberProjects')}</p>
            )}
          </div>
        </div>
      </div>
    </AdaptiveLayout>
  );
}

// Memoize the entire page component to prevent unnecessary re-renders
export default memo(ProfilePageComponent);
