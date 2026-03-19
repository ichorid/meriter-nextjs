'use client';

import React, { useMemo, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useUserProfile } from '@/hooks/api/useUsers';
import { useUserRoles } from '@/hooks/api/useProfile';
import { routes } from '@/lib/constants/routes';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { User as UserIcon } from 'lucide-react';
import { Separator } from '@/components/ui/shadcn/separator';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { ProfileHero } from '@/components/organisms/Profile/ProfileHero';
import { MeritsAndQuotaSection } from './MeritsAndQuotaSection';
import { CommunityCard } from '@/components/organisms/CommunityCard';

const PRIORITY_TYPE_TAGS = ['marathon-of-good', 'future-vision', 'team-projects', 'support'] as const;

function isPriorityTypeTag(tag: string | undefined): boolean {
  return !!tag && PRIORITY_TYPE_TAGS.includes(tag as (typeof PRIORITY_TYPE_TAGS)[number]);
}

export function UserProfilePageClient({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const tCommon = useTranslations('common');
  const tCommunities = useTranslations('communities');

  const { data: user, isLoading, error, isFetched } = useUserProfile(userId);
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles(userId);

  const [meritsExpanded, setMeritsExpanded] = useLocalStorage<boolean>(`userProfile.${userId}.meritsExpanded`, true);

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

  return (
    <AdaptiveLayout
      stickyHeader={
        <SimpleStickyHeader title={tCommon('userProfile')} showBack={true} asStickyHeader={true} showScrollToTop={true} />
      }
    >
      <div className="space-y-0">
        <ProfileHero
          user={user}
          showEdit={false}
          userRoles={userRoles}
        />

        {communityIds.length > 0 && (
          <div>
            <Separator className="bg-base-300" />
            <MeritsAndQuotaSection
              userId={user.id}
              communityIds={communityIds}
              userRoles={userRolesForMerits}
              expanded={meritsExpanded}
              onToggleExpanded={() => setMeritsExpanded(!meritsExpanded)}
              showLocalTeamGroups={false}
            />
          </div>
        )}

        <div>
          <Separator className="bg-base-300" />
          <div className="bg-base-100 py-4 space-y-4">
            <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-4">
              {tCommunities('administeredCommunities')}
            </p>
            {rolesLoading ? (
              <div className="flex flex-col gap-1 px-4">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : administeredCommunityIds.length > 0 ? (
              <div className="flex flex-col gap-1 px-4">
                {administeredCommunityIds.map((communityId) => (
                  <CommunityCard
                    key={communityId}
                    communityId={communityId}
                    pathname={pathname}
                    isExpanded={true}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-base-content/50 px-4">
                {tCommunities('noAdministeredCommunitiesOther', { name: displayName })}
              </p>
            )}

            <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-4">
              {tCommunities('communitiesIMemberOf')}
            </p>
            {rolesLoading ? (
              <div className="flex flex-col gap-1 px-4">
                <CardSkeleton />
              </div>
            ) : memberCommunityIds.length > 0 ? (
              <div className="flex flex-col gap-1 px-4">
                {memberCommunityIds.map((communityId) => (
                  <CommunityCard
                    key={communityId}
                    communityId={communityId}
                    pathname={pathname}
                    isExpanded={true}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-base-content/50 px-4">
                {tCommunities('noMemberCommunitiesOther', { name: displayName })}
              </p>
            )}

            <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-4">
              {tCommunities('administeredProjects')}
            </p>
            {rolesLoading ? (
              <div className="flex flex-col gap-1 px-4">
                <CardSkeleton />
              </div>
            ) : administeredProjectIds.length > 0 ? (
              <div className="flex flex-col gap-1 px-4">
                {administeredProjectIds.map((communityId) => (
                  <CommunityCard
                    key={communityId}
                    communityId={communityId}
                    pathname={pathname}
                    isExpanded={true}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-base-content/50 px-4">
                {tCommunities('noAdministeredProjectsOther', { name: displayName })}
              </p>
            )}

            <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide px-4">
              {tCommunities('memberProjects')}
            </p>
            {rolesLoading ? (
              <div className="flex flex-col gap-1 px-4">
                <CardSkeleton />
              </div>
            ) : memberProjectIds.length > 0 ? (
              <div className="flex flex-col gap-1 px-4">
                {memberProjectIds.map((communityId) => (
                  <CommunityCard
                    key={communityId}
                    communityId={communityId}
                    pathname={pathname}
                    isExpanded={true}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-base-content/50 px-4">
                {tCommunities('noMemberProjectsOther', { name: displayName })}
              </p>
            )}
          </div>
        </div>
      </div>
    </AdaptiveLayout>
  );
}
