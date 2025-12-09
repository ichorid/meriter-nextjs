'use client';

import React from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useUserProfile } from '@/hooks/api/useUsers';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { InfoCard } from '@/components/ui/InfoCard';
import { Loader2, Mail, MessageCircle, Globe, MapPin, GraduationCap, User as UserIcon } from 'lucide-react';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const router = useRouter();
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const resolvedParams = use(params);
  const userId = resolvedParams.userId;

  const { data: user, isLoading, error } = useUserProfile(userId);

  if (isLoading) {
    return (
      <AdaptiveLayout>
        <div className="flex flex-col h-full bg-base-100 overflow-hidden">
          <PageHeader title={tCommon('userProfile')} showBack={true} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </AdaptiveLayout>
    );
  }

  if (error || !user) {
    return (
      <AdaptiveLayout>
        <div className="flex flex-col h-full bg-base-100 overflow-hidden">
          <PageHeader title={tCommon('userProfile')} showBack={true} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
            <div className="text-center py-12 text-base-content/60">
              <UserIcon className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
              <p className="font-medium">{tCommon('userNotFound')}</p>
              <p className="text-sm mt-1">{tCommon('userNotFoundDescription')}</p>
            </div>
          </div>
        </div>
      </AdaptiveLayout>
    );
  }

  const profile = user.profile || {};
  const contacts = profile.contacts || {};

  return (
    <AdaptiveLayout>
      <div className="flex flex-col h-full bg-base-100 overflow-hidden">
        <PageHeader title={tCommon('userProfile')} showBack={true} />

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6">
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
      </div>
    </AdaptiveLayout>
  );
}

