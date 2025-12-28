'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, useMeritStats } from '@/hooks/api/useProfile';
import { ProfileEditForm } from '@/components/organisms/Profile/ProfileEditForm';
import { ProfileHero } from '@/components/organisms/Profile/ProfileHero';
import { ProfileStats } from '@/components/organisms/Profile/ProfileStats';
import { UseInvite } from '@/components/organisms/Profile/UseInvite';
import { ProfileContentCards } from '@/components/organisms/Profile/ProfileContentCards';
import { FoldableInviteInput } from '@/components/organisms/Profile/FoldableInviteInput';
import { useProfileData } from '@/hooks/useProfileData';
import { Button } from '@/components/ui/shadcn/button';
import { routes } from '@/lib/constants/routes';
import { InviteHandler } from '@/components/InviteHandler';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { ProfileTopBar } from '@/components/organisms/ContextTopBar/ContextTopBar';

function ProfilePageComponent() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
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
        {isEditing ? (
          <div className="bg-base-200/50 border border-base-content/5 rounded-2xl p-6">
            <ProfileEditForm
              onCancel={() => setIsEditing(false)}
              onSuccess={() => setIsEditing(false)}
            />
          </div>
        ) : (
          <ProfileHero
            user={user}
            stats={heroStats}
            onEdit={() => setIsEditing(true)}
            showEdit={true}
            userRoles={userRolesArray}
          />
        )}

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

        {/* Foldable Invite Input Section */}
        <FoldableInviteInput />

        {/* Use Invite Section (for viewers) */}
        <UseInvite />
      </div>
    </AdaptiveLayout>
  );
}

export default ProfilePageComponent;
