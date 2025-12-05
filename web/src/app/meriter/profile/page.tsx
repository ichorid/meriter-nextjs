'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, useUserProjects, useMeritStats, useLeadCommunities } from '@/hooks/api/useProfile';
import { ProfileEditForm } from '@/components/organisms/Profile/ProfileEditForm';
import { ProfileHero } from '@/components/organisms/Profile/ProfileHero';
import { ProfileStats } from '@/components/organisms/Profile/ProfileStats';
import { InviteGeneration } from '@/components/organisms/Profile/InviteGeneration';
import { ProfileContentCards } from '@/components/organisms/Profile/ProfileContentCards';
import { useProfileData } from '@/hooks/useProfileData';
import { PageHeader } from '@/components/ui/PageHeader';
import { InfoCard } from '@/components/ui/InfoCard';
import { BrandButton } from '@/components/ui/BrandButton';
import { routes } from '@/lib/constants/routes';
import Link from 'next/link';
import { Briefcase, Users, Loader2, UserPlus, Settings } from 'lucide-react';

type SortOption = 'recent' | 'oldest' | 'title';

export default function ProfilePage() {
  const router = useRouter();
  const t = useTranslations('profile');
  const { user, isLoading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const { data: roles, isLoading: rolesLoading } = useUserRoles(user?.id || '');
  const { data: leadCommunities, isLoading: leadCommunitiesLoading } = useLeadCommunities(user?.id || '');
  
  // Get profile content data for cards
  const {
    myPublications,
    publicationsLoading,
    myComments,
    commentsLoading,
    myPolls,
    pollsLoading,
  } = useProfileData();

  const {
    data: projectsData,
    isLoading: projectsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserProjects(user?.id || '', 20);
  const { data: meritStatsData, isLoading: meritStatsLoading } = useMeritStats();

  // Merge roles and lead communities
  const allRoles = useMemo(() => {
    const combined = [...(roles || [])];

    if (leadCommunities) {
      leadCommunities.forEach(community => {
        // Check if role already exists
        const exists = combined.some(r => r.communityId === community.id);
        if (!exists) {
          combined.push({
            id: `lead-${community.id}`,
            userId: user?.id || '',
            communityId: community.id,
            role: 'lead',
            communityName: community.name,
            createdAt: community.createdAt,
            updatedAt: community.updatedAt
          });
        }
      });
    }
    return combined;
  }, [roles, leadCommunities, user?.id]);

  // Flatten projects from all pages
  const allProjects = projectsData?.pages.flatMap((page) => page.data || []) || [];

  // Sort projects
  const projects = useMemo(() => {
    const sorted = [...allProjects];
    switch (sortBy) {
      case 'oldest':
        return sorted.sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case 'title':
        return sorted.sort((a, b) =>
          (a.title || a.description || '').localeCompare(b.title || b.description || '')
        );
      case 'recent':
      default:
        return sorted.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
  }, [allProjects, sortBy]);

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
      <div className="flex flex-col min-h-screen bg-base-100">
        <PageHeader
          title={t('title')}
          showBack={true}
          rightAction={
            <Link href={routes.settings}>
              <BrandButton
                variant="ghost"
                size="sm"
                className="px-2"
                aria-label="Settings"
              >
                <Settings size={18} />
              </BrandButton>
            </Link>
          }
        />

        <div className="p-4 space-y-6">
          {/* Profile Hero Section */}
          {isEditing ? (
            <div className="bg-brand-surface border border-brand-secondary/10 rounded-xl p-6">
              <ProfileEditForm
                onCancel={() => setIsEditing(false)}
                onSuccess={() => setIsEditing(false)}
              />
            </div>
          ) : (
            <ProfileHero
              user={user}
              stats={{
                projects: projects.length,
                roles: allRoles.length,
                merits: meritStatsData?.meritStats?.reduce((sum, stat) => sum + stat.amount, 0) || 0,
              }}
              onEdit={() => setIsEditing(true)}
              showEdit={true}
              userRoles={roles || []}
            />
          )}

          {/* Merit Statistics */}
          {meritStatsData?.meritStats && meritStatsData.meritStats.length > 0 && (
            <ProfileStats
              meritStats={meritStatsData.meritStats}
              isLoading={meritStatsLoading}
            />
          )}

          {/* Divider */}
          <div className="border-t border-brand-secondary/10" />

          {/* Content Cards (Publications, Comments, Polls) */}
          <ProfileContentCards
            userName={
              user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.firstName || user?.displayName || user?.username || undefined
            }
            userAvatar={user?.avatarUrl}
            stats={{
              publications: myPublications.length,
              comments: myComments.length,
              polls: myPolls.length,
            }}
            isLoading={
              publicationsLoading ||
              commentsLoading ||
              pollsLoading
            }
          />

          {/* Divider */}
          <div className="border-t border-brand-secondary/10" />

          {/* Invite Generation Section */}
          <InviteGeneration />

          {/* Divider */}
          <div className="border-t border-brand-secondary/10" />

          {/* Roles in Communities */}
          <div className="bg-brand-surface border border-brand-secondary/10 rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="text-brand-primary bg-brand-primary/10 p-2 rounded-lg">
                <Users size={24} />
              </div>
              <h2 className="text-lg font-bold text-brand-text-primary">{t('roles')}</h2>
            </div>

            {rolesLoading || leadCommunitiesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              </div>
            ) : allRoles && allRoles.length > 0 ? (
              <div className="space-y-3">
                {allRoles.map((role) => (
                  <InfoCard
                    key={`${role.communityId}-${role.role}`}
                    title={role.communityName || role.communityId}
                    subtitle={t(`roleTypes.${role.role}`)}
                    onClick={() => router.push(`/meriter/communities/${role.communityId}`)}
                    className="hover:shadow-md transition-shadow"
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
                <p className="text-brand-text-secondary">{t('noRoles')}</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-brand-secondary/10" />

          {/* Projects */}
          <div className="bg-brand-surface border border-brand-secondary/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="text-brand-primary bg-brand-primary/10 p-2 rounded-lg">
                  <Briefcase size={24} />
                </div>
                <h2 className="text-lg font-bold text-brand-text-primary">{t('projects')}</h2>
              </div>
              {projects.length > 0 && (
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="text-sm border border-brand-secondary/20 rounded-lg px-3 py-1.5 bg-base-100 text-brand-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="recent">{t('sortBy.recent')}</option>
                  <option value="oldest">{t('sortBy.oldest')}</option>
                  <option value="title">{t('sortBy.title')}</option>
                </select>
              )}
            </div>

            {projectsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              </div>
            ) : projects && projects.length > 0 ? (
              <div className="space-y-3">
                {projects.map((project) => (
                  <InfoCard
                    key={project.id}
                    title={project.title || project.description || 'Untitled Project'}
                    subtitle={(project as any).communityName || project.communityId}
                    onClick={() => router.push(`/meriter/communities/${project.communityId}/posts/${project.id}`)}
                    className="hover:shadow-md transition-shadow"
                  />
                ))}
                {hasNextPage && (
                  <BrandButton
                    variant="outline"
                    size="md"
                    fullWidth
                    onClick={() => fetchNextPage()}
                    isLoading={isFetchingNextPage}
                    disabled={isFetchingNextPage}
                    className="mt-4"
                  >
                    {isFetchingNextPage ? t('loading') : t('loadMore')}
                  </BrandButton>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Briefcase className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
                <p className="text-brand-text-secondary">{t('noProjects')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdaptiveLayout>
  );
}
