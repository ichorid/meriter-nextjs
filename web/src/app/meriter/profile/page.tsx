'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, useUserProjects, useMeritStats } from '@/hooks/api/useProfile';
import { ProfileEditForm } from '@/components/organisms/Profile/ProfileEditForm';
import { ProfileHero } from '@/components/organisms/Profile/ProfileHero';
import { ProfileStats } from '@/components/organisms/Profile/ProfileStats';
import { InviteGeneration } from '@/components/organisms/Profile/InviteGeneration';
import { UseInvite } from '@/components/organisms/Profile/UseInvite';
import { ProfileContentCards } from '@/components/organisms/Profile/ProfileContentCards';
import { useProfileData } from '@/hooks/useProfileData';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandButton } from '@/components/ui/BrandButton';
import { routes } from '@/lib/constants/routes';
import Link from 'next/link';
import { Loader2, Settings } from 'lucide-react';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const { user, isLoading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const { data: roles } = useUserRoles(user?.id || '');
  
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
  } = useUserProjects(user?.id || '', 20);
  const { data: meritStatsData, isLoading: meritStatsLoading } = useMeritStats();

  // Flatten projects from all pages for counting
  const projects = useMemo(() => {
    return (projectsData?.pages ?? []).flatMap((page) => page.data || []);
  }, [projectsData?.pages]);

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
              projects: projects.length,
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

          {/* Use Invite Section (for viewers) */}
          <UseInvite />

        </div>
      </div>
    </AdaptiveLayout>
  );
}
