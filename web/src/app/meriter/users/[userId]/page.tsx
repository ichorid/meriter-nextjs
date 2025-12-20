'use client';

import React, { useMemo } from 'react';
import { use } from 'react';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useUserProfile } from '@/hooks/api/useUsers';
import { useUserRoles } from '@/hooks/api/useProfile';

import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { Badge } from '@/components/atoms';
import { Mail, MessageCircle, Globe, MapPin, GraduationCap, User as UserIcon, Users } from 'lucide-react';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { MeritsAndQuotaSection } from './MeritsAndQuotaSection';

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const resolvedParams = use(params);
  const userId = resolvedParams.userId;

  const { data: user, isLoading, error } = useUserProfile(userId);
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles(userId);

  // Get unique community IDs from user roles
  const communityIds = useMemo(() => {
    return Array.from(new Set(userRoles.map(role => role.communityId)));
  }, [userRoles]);

  if (isLoading) {
    return (
      <AdaptiveLayout
        stickyHeader={<SimpleStickyHeader title={tCommon('userProfile')} showBack={true} asStickyHeader={true} />}
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
        stickyHeader={<SimpleStickyHeader title={tCommon('userProfile')} showBack={true} asStickyHeader={true} />}
      >
        <div className="text-center py-12 text-base-content/60">
          <UserIcon className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
          <p className="font-medium">{tCommon('userNotFound')}</p>
          <p className="text-sm mt-1">{tCommon('userNotFoundDescription')}</p>
        </div>
      </AdaptiveLayout>
    );
  }

  const profile = user.profile || {};
  const contacts = profile.contacts || {};

  return (
    <AdaptiveLayout
      stickyHeader={<SimpleStickyHeader title={tCommon('userProfile')} showBack={true} asStickyHeader={true} />}
    >
      <div className="space-y-6">
        {/* Profile Header */}
        <div className="bg-brand-surface border border-brand-secondary/10 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <BrandAvatar
              src={user.avatarUrl}
              fallback={user.displayName || user.username || tCommon('user')}
              size="lg"
              className="bg-transparent"
            />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-brand-text-primary mb-1">
                {user.displayName || user.username || tCommon('unknownUser')}
              </h1>
              {user.username && (
                <p className="text-sm text-brand-text-secondary mb-2">@{user.username}</p>
              )}
              {profile.bio && (
                <p className="text-sm text-brand-text-secondary mt-2">{profile.bio}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        {(contacts.email || contacts.messenger || profile.website || profile.location || profile.educationalInstitution) && (
          <div className="bg-brand-surface border border-brand-secondary/10 rounded-xl p-6">
            <h2 className="text-lg font-bold text-brand-text-primary mb-4">{tCommon('contactInformation')}</h2>
            <div className="space-y-3">
              {contacts.email && (
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-brand-primary" />
                  <a
                    href={`mailto:${contacts.email}`}
                    className="text-brand-text-primary hover:text-brand-primary transition-colors"
                  >
                    {contacts.email}
                  </a>
                </div>
              )}
              {contacts.messenger && (
                <div className="flex items-center gap-3">
                  <MessageCircle size={18} className="text-brand-primary" />
                  <span className="text-brand-text-primary">{contacts.messenger}</span>
                </div>
              )}
              {profile.website && (
                <div className="flex items-center gap-3">
                  <Globe size={18} className="text-brand-primary" />
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-text-primary hover:text-brand-primary transition-colors"
                  >
                    {profile.website}
                  </a>
                </div>
              )}
              {profile.location && (
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-brand-primary" />
                  <span className="text-brand-text-primary">
                    {profile.location.city && profile.location.region
                      ? `${profile.location.city}, ${profile.location.region}`
                      : profile.location.city || profile.location.region}
                  </span>
                </div>
              )}
              {profile.educationalInstitution && (
                <div className="flex items-center gap-3">
                  <GraduationCap size={18} className="text-brand-primary" />
                  <span className="text-brand-text-primary">{profile.educationalInstitution}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Additional Information */}
        {profile.about && (
          <div className="bg-brand-surface border border-brand-secondary/10 rounded-xl p-6">
            <h2 className="text-lg font-bold text-brand-text-primary mb-4">{tCommon('about')}</h2>
            <div className="space-y-4">
              {profile.about && (
                <div>
                  <h3 className="text-sm font-medium text-brand-text-secondary mb-2">About</h3>
                  <p className="text-sm text-brand-text-primary whitespace-pre-wrap">{profile.about}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Teams & Roles */}
        {!rolesLoading && userRoles.length > 0 && (
          <div className="bg-brand-surface border border-brand-secondary/10 rounded-xl p-6">
            <h2 className="text-lg font-bold text-brand-text-primary mb-4 flex items-center gap-2">
              <Users size={20} className="text-brand-primary" />
              {t('teamsAndRoles') || 'Teams & Roles'}
            </h2>
            <div className="flex flex-wrap gap-2">
              {userRoles.map((userRole) => {
                const roleVariant =
                  userRole.role === 'lead' ? 'accent' :
                    userRole.role === 'participant' ? 'info' :
                      'secondary';

                const roleLabel =
                  userRole.role === 'lead' ? tCommon('lead') :
                    userRole.role === 'participant' ? tCommon('participant') :
                      tCommon('viewer');

                return (
                  <Badge
                    key={userRole.id}
                    variant={roleVariant}
                    size="sm"
                  >
                    {userRole.communityName || userRole.communityId} - {roleLabel}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Merits & Quota per Community */}
        {!rolesLoading && communityIds.length > 0 && (
          <MeritsAndQuotaSection userId={userId} communityIds={communityIds} userRoles={userRoles} />
        )}

        {/* Empty State if no profile info */}
        {!profile.bio &&
          !contacts.email &&
          !contacts.messenger &&
          !profile.website &&
          !profile.location &&
          !profile.educationalInstitution &&
          !profile.about && (
            <div className="text-center py-12 text-base-content/60">
              <UserIcon className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
              <p className="font-medium">{tCommon('noProfileInformation')}</p>
              <p className="text-sm mt-1">{tCommon('noProfileInformationDescription')}</p>
            </div>
          )}
      </div>
    </AdaptiveLayout>
  );
}

