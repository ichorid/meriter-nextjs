'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, useMeritStats } from '@/hooks/api/useProfile';
import { ProfileHero } from '@/components/organisms/Profile/ProfileHero';
import { ProfileStats } from '@/components/organisms/Profile/ProfileStats';
import { ProfileContentCards } from '@/components/organisms/Profile/ProfileContentCards';
import { JoinTeam } from '@/components/organisms/Profile/JoinTeam';
import { useProfileData } from '@/hooks/useProfileData';
import { InviteHandler } from '@/components/InviteHandler';
import { Loader2 } from 'lucide-react';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';

function ProfilePageComponent() {
  const t = useTranslations('profile');
  const { user, isLoading: authLoading } = useAuth();

  const { data: roles } = useUserRoles(user?.id || '');

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

  const totalMerits =
    meritStatsData?.meritStats?.reduce((sum, stat) => sum + stat.amount, 0) || 0;

  const heroStats = { merits: totalMerits };

  const contentCardsStats = {
    publications: myPublications.length,
    comments: myComments.length,
    polls: myPolls.length,
    favorites: favoritesCount,
  };

  const contentCardsLoading = publicationsLoading || commentsLoading || pollsLoading;

  const userRolesArray = roles || [];

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
    <AdaptiveLayout
      stickyHeader={
        <ProfileTopBar asStickyHeader={true} />
      }
    >
      <InviteHandler />
      <div className="space-y-6">
        {/* Profile Hero Section */}
        <ProfileHero
          user={user}
          stats={heroStats}
          showEdit={true}
          userRoles={userRolesArray}
        />

        {/* Merit Statistics */}
        {meritStatsData?.meritStats && meritStatsData.meritStats.length > 0 && (
          <ProfileStats
            meritStats={meritStatsData.meritStats}
            isLoading={meritStatsLoading}
          />
        )}

        {/* Content Cards (Publications, Comments, Polls) */}
        <ProfileContentCards
          stats={contentCardsStats}
          isLoading={contentCardsLoading}
        />

        {/* Join a Team Section */}
        <JoinTeam />
      </div>
    </AdaptiveLayout>
  );
}

export default ProfilePageComponent;
