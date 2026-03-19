'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User as UserIcon, Edit, Settings, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { Separator } from '@/components/ui/shadcn/separator';
import { Button } from '@/components/ui/shadcn/button';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocalStorage } from '@/hooks/useLocalStorage';

import type { User } from '@/types/api-v1';

interface ProfileHeroProps {
  user: User | null | undefined;
  stats?: {
    merits: number;
  };
  showEdit?: boolean;
  userRoles?: Array<{ id: string; role: string; communityId?: string; communityName?: string; communityTypeTag?: string }>;
  onEdit?: () => void;
}

function ProfileHeroComponent({ user, stats: _stats, showEdit = false, userRoles = [], onEdit }: ProfileHeroProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
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

  return (
    <div className="relative bg-base-100 overflow-hidden">
      {/* Cover Section */}
      <div className="relative h-24 bg-gradient-to-br from-base-content/5 via-base-content/3 to-transparent">
        {/* Edit and Settings buttons */}
        {showEdit && (
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit ? onEdit() : router.push('/meriter/profile/edit')}
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
          </div>
        )}
      </div>

      {/* Profile Content */}
      <div className="relative pb-5">
        {/* Avatar */}
        <div className="-mt-10 mb-4">
          <div className="relative inline-block">
            <Avatar className="w-20 h-20 text-xl border-4 border-base-100 shadow-md bg-base-200">
              {avatarUrl && (
                <AvatarImage src={avatarUrl} alt={displayName} />
              )}
              <AvatarFallback userId={user.id} className="font-medium uppercase">
                {displayName ? displayName.slice(0, 2).toUpperCase() : <UserIcon size={32} />}
              </AvatarFallback>
            </Avatar>
            {/* Online indicator */}
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-success border-2 border-base-100 rounded-full" />
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
