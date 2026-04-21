'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User as UserIcon, Edit, Settings, ChevronDown, ChevronUp, Mail, Share2 } from 'lucide-react';
import { Separator } from '@/components/ui/shadcn/separator';
import { Button } from '@/components/ui/shadcn/button';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { shareUrl, getProfileUrl } from '@shared/lib/share-utils';
import { hapticImpact } from '@shared/lib/utils/haptic-utils';

import type { User } from '@/types/api-v1';
import { cn } from '@/lib/utils';

interface ProfileHeroProps {
  user: User | null | undefined;
  stats?: {
    merits: number;
  };
  showEdit?: boolean;
  userRoles?: Array<{ id: string; role: string; communityId?: string; communityName?: string; communityTypeTag?: string }>;
  onEdit?: () => void;
  /** Compact merits / history row to the right of the avatar (same vertical band as `-mt-10`). */
  meritsHeroSlot?: React.ReactNode;
}

function ProfileHeroComponent({
  user,
  stats: _stats,
  showEdit = false,
  userRoles = [],
  onEdit,
  meritsHeroSlot,
}: ProfileHeroProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const tShared = useTranslations('shared');
  const router = useRouter();
  const [aboutExpanded, setAboutExpanded] = useLocalStorage<boolean>('profile.aboutExpanded', true);
  const [contactsExpanded, setContactsExpanded] = useLocalStorage<boolean>('profile.contactsExpanded', true);

  if (!user) return null;

  const displayName = user.displayName || user.username || tCommon('user');
  const avatarUrl = user.avatarUrl;
  const bio = user.profile?.bio;
  const location = user.profile?.location;
  const website = user.profile?.website;
  const about = user.profile?.about;
  const educationalInstitution = user.profile?.educationalInstitution;
  const contacts = user.profile?.contacts;

  const isRepresentativeOrMember = user.globalRole === 'superadmin' ||
    userRoles.some(r => r.role === 'lead' || r.role === 'participant');

  const showContacts = user.globalRole === 'superadmin' ||
    userRoles.some(r => r.role === 'lead');

  const handleShareProfile = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hapticImpact('light');
    await shareUrl(getProfileUrl(user.id), tShared('urlCopiedToBuffer'));
  };

  return (
    <div className="relative bg-base-100 overflow-hidden">
      {/* Cover Section */}
      <div className="relative h-24 bg-gradient-to-br from-base-content/5 via-base-content/3 to-transparent">
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {showEdit && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (onEdit ? onEdit() : router.push('/meriter/profile/edit'))}
                className="rounded-xl active:scale-[0.98] bg-base-100/80 backdrop-blur-sm hover:bg-base-100 text-base-content/70 h-8 px-3"
              >
                <Edit size={14} className="mr-1.5" />
                <span className="text-xs">{tCommon('edit')}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/meriter/settings')}
                aria-label={tCommon('settings')}
                className="rounded-xl active:scale-[0.98] bg-base-100/80 backdrop-blur-sm hover:bg-base-100 text-base-content/70 h-8 w-8 p-0"
              >
                <Settings size={18} />
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={handleShareProfile}
            className="p-1.5 rounded-full hover:bg-base-200/90 transition-colors text-base-content/60 hover:text-base-content/90 flex-shrink-0 bg-base-100/80 backdrop-blur-sm"
            aria-label={tShared('share')}
            title={tShared('share')}
          >
            <Share2 className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Profile Content */}
      <div className="relative pb-5">
        {/* Avatar + optional merits — one card when merits are shown */}
        <div className={cn('-mt-10', meritsHeroSlot ? 'mb-6' : 'mb-4')}>
          <div className={cn(meritsHeroSlot && 'py-1 sm:py-2')}>
            <div
              className={cn(
                'flex',
                meritsHeroSlot
                  ? 'flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8'
                  : 'min-h-[5rem] items-end gap-3',
              )}
            >
              <div className="relative shrink-0">
                <Avatar
                  className={cn(
                    'border-4 border-base-100 bg-base-200 text-xl shadow-md',
                    meritsHeroSlot ? 'h-24 w-24 sm:h-[5.5rem] sm:w-[5.5rem]' : 'h-20 w-20',
                  )}
                >
                  {avatarUrl && (
                    <AvatarImage src={avatarUrl} alt={displayName} />
                  )}
                  <AvatarFallback userId={user.id} className="font-medium uppercase">
                    {displayName ? displayName.slice(0, 2).toUpperCase() : <UserIcon size={32} />}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-base-100 bg-success" />
              </div>
              {meritsHeroSlot ? (
                <>
                  <div
                    className="hidden h-[4.5rem] w-px shrink-0 bg-gradient-to-b from-transparent via-base-content/15 to-transparent sm:block"
                    aria-hidden
                  />
                  <div className="w-full min-w-0 flex-1 sm:w-auto">{meritsHeroSlot}</div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Name & Username */}
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-base-content">
            {displayName}
          </h1>
          {user.username && (
            <p className="text-sm text-base-content/50 mt-0.5">
              @{user.username}
            </p>
          )}
        </div>

        {/* Info Sections */}
        <div className="space-y-0">
          {/* Bio */}
          {bio && (
            <p className="text-sm text-base-content/80 leading-relaxed pb-4">
              {bio}
            </p>
          )}

          {/* About */}
          {about && (
            <>
              {bio && <Separator className="bg-base-300 my-0" />}
              <div className="bg-base-100 py-4 space-y-3">
                <button
                  onClick={() => setAboutExpanded(!aboutExpanded)}
                  className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
                >
                  <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
                    {t('about')}
                  </p>
                  {aboutExpanded ? (
                    <ChevronUp className="w-4 h-4 text-base-content/40" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-base-content/40" />
                  )}
                </button>
                {aboutExpanded && (
                  <div className="animate-in fade-in duration-200 space-y-3">
                    <p className="text-sm text-base-content/70 leading-relaxed">
                      {about}
                    </p>
                    
                    {/* Location & Website */}
                    {(location?.city || website) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-base-content/50">
                        {location?.city && location?.region && (
                          <span className="flex items-center gap-1">
                            <span className="text-base-content/30">📍</span>
                            {location.city}, {location.region}
                          </span>
                        )}
                        {website && (
                          <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base-content/60 hover:text-base-content transition-colors"
                          >
                            {website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}


          {/* Educational Institution */}
          {isRepresentativeOrMember && educationalInstitution && (
            <>
              {(about || bio) && <Separator className="bg-base-300 my-0" />}
              <div className="bg-base-100 py-4">
                <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide mb-1">
                  {t('educationalInstitution')}
                </p>
                <p className="text-sm text-base-content/70">
                  {educationalInstitution}
                </p>
              </div>
            </>
          )}

          {/* Contacts */}
          {showContacts && contacts && (contacts.email || contacts.messenger) && (
            <>
              {(about || bio || (isRepresentativeOrMember && educationalInstitution)) && <Separator className="bg-base-300 my-0" />}
              <div className="bg-base-100 py-4 space-y-3">
                <button
                  onClick={() => setContactsExpanded(!contactsExpanded)}
                  className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
                >
                  <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
                    {t('contacts')}
                  </p>
                  {contactsExpanded ? (
                    <ChevronUp className="w-4 h-4 text-base-content/40" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-base-content/40" />
                  )}
                </button>
                {contactsExpanded && (
                  <div className="animate-in fade-in duration-200 space-y-4">
                    {/* Email */}
                    {contacts.email && (
                      <a
                        href={`mailto:${contacts.email}`}
                        className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors underline decoration-primary/30 hover:decoration-primary/60"
                      >
                        <Mail className="w-4 h-4" />
                        {contacts.email}
                      </a>
                    )}
                    
                    {/* Additional Contacts */}
                    {contacts.messenger && (
                      <div>
                        <p className="text-xs text-base-content/50 mb-1.5">
                          {t('otherContacts')}
                        </p>
                        <p className="text-sm text-base-content/70 leading-relaxed whitespace-pre-line">
                          {contacts.messenger}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
            )}
        </div>
      </div>
    </div>
  );
}

export const ProfileHero = ProfileHeroComponent;
