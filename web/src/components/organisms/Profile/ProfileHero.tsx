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
import { trackMeriterUiEvent } from '@/lib/telemetry/meriter-ui-telemetry';

const sectionCardClass =
  'rounded-xl border border-base-300/40 bg-base-100/50 backdrop-blur-sm py-4 px-4 sm:px-4 space-y-3';

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

  const isRepresentativeOrMember =
    user.globalRole === 'superadmin' || userRoles.some((r) => r.role === 'lead' || r.role === 'participant');

  const showContacts = user.globalRole === 'superadmin' || userRoles.some((r) => r.role === 'lead');

  const handleShareProfile = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hapticImpact('light');
    trackMeriterUiEvent({ name: 'profile_share' });
    await shareUrl(getProfileUrl(user.id), tShared('urlCopiedToBuffer'));
  };

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-base-300/50 bg-base-200/15 shadow-sm">
      <div className="relative h-28 bg-gradient-to-br from-primary/18 via-base-content/[0.07] to-transparent sm:h-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        </div>
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          {showEdit && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  trackMeriterUiEvent({ name: 'profile_edit_open' });
                  if (onEdit) onEdit();
                  else router.push('/meriter/profile/edit');
                }}
                className="h-8 rounded-xl border border-base-300/30 bg-base-100/85 px-3 text-base-content/80 shadow-sm backdrop-blur-sm hover:bg-base-100 active:scale-[0.98]"
              >
                <Edit size={14} className="mr-1.5" />
                <span className="text-xs font-medium">{tCommon('edit')}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  trackMeriterUiEvent({ name: 'profile_settings_open' });
                  router.push('/meriter/settings');
                }}
                aria-label={tCommon('settings')}
                className="h-8 w-8 rounded-xl border border-base-300/30 bg-base-100/85 p-0 text-base-content/80 shadow-sm backdrop-blur-sm hover:bg-base-100 active:scale-[0.98]"
              >
                <Settings size={18} />
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={handleShareProfile}
            className="flex-shrink-0 rounded-full border border-base-300/30 bg-base-100/85 p-2 text-base-content/65 shadow-sm backdrop-blur-sm transition-colors hover:bg-base-100 hover:text-base-content"
            aria-label={tShared('share')}
            title={tShared('share')}
          >
            <Share2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="relative z-10 -mt-10 px-4 pb-6 sm:px-6">
        <div
          className={cn(
            'grid gap-6',
            meritsHeroSlot ? 'grid-cols-1 lg:grid-cols-12 lg:items-start' : 'grid-cols-1',
          )}
        >
          <div className={cn('min-w-0 space-y-4', meritsHeroSlot && 'lg:col-span-8')}>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-start sm:gap-6">
              <div className="relative shrink-0">
                <Avatar
                  className={cn(
                    'border-4 border-base-100 bg-base-200 text-xl shadow-lg ring-2 ring-base-300/25',
                    meritsHeroSlot
                      ? 'h-28 w-28 rounded-2xl sm:h-[5.5rem] sm:w-[5.5rem]'
                      : 'h-20 w-20 rounded-2xl',
                  )}
                >
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback userId={user.id} className="rounded-2xl font-medium uppercase">
                    {displayName ? displayName.slice(0, 2).toUpperCase() : <UserIcon size={32} />}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-base-100 bg-success" />
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-base-content sm:text-3xl">{displayName}</h1>
              {user.username && (
                <p className="mt-1 text-sm font-medium text-base-content/50">@{user.username}</p>
              )}
            </div>

            {bio && <p className="text-sm leading-relaxed text-base-content/80">{bio}</p>}

            {about && (
              <>
                {bio ? <Separator className="my-1 bg-base-300/60" /> : null}
                <div className={sectionCardClass}>
                  <button
                    type="button"
                    onClick={() => setAboutExpanded(!aboutExpanded)}
                    className="flex w-full items-center justify-between transition-opacity hover:opacity-90"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-base-content/45">{t('about')}</p>
                    {aboutExpanded ? (
                      <ChevronUp className="h-4 w-4 text-base-content/40" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-base-content/40" />
                    )}
                  </button>
                  {aboutExpanded && (
                    <div className="animate-in fade-in space-y-3 duration-200">
                      <p className="text-sm leading-relaxed text-base-content/75">{about}</p>
                      {(location?.city || website) && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-base-content/55">
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
                              className="text-primary/90 transition-colors hover:text-primary hover:underline"
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

            {isRepresentativeOrMember && educationalInstitution && (
              <>
                {(about || bio) ? <Separator className="my-1 bg-base-300/60" /> : null}
                <div className={sectionCardClass}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/45">
                    {t('educationalInstitution')}
                  </p>
                  <p className="text-sm text-base-content/75">{educationalInstitution}</p>
                </div>
              </>
            )}

            {showContacts && contacts && (contacts.email || contacts.messenger) && (
              <>
                {(about || bio || (isRepresentativeOrMember && educationalInstitution)) ? (
                  <Separator className="my-1 bg-base-300/60" />
                ) : null}
                <div className={sectionCardClass}>
                  <button
                    type="button"
                    onClick={() => setContactsExpanded(!contactsExpanded)}
                    className="flex w-full items-center justify-between transition-opacity hover:opacity-90"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-base-content/45">
                      {t('contacts')}
                    </p>
                    {contactsExpanded ? (
                      <ChevronUp className="h-4 w-4 text-base-content/40" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-base-content/40" />
                    )}
                  </button>
                  {contactsExpanded && (
                    <div className="animate-in fade-in space-y-4 duration-200">
                      {contacts.email && (
                        <a
                          href={`mailto:${contacts.email}`}
                          className="inline-flex items-center gap-2 text-sm text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary/70"
                        >
                          <Mail className="h-4 w-4" />
                          {contacts.email}
                        </a>
                      )}
                      {contacts.messenger && (
                        <div>
                          <p className="mb-1.5 text-xs text-base-content/50">{t('otherContacts')}</p>
                          <p className="whitespace-pre-line text-sm leading-relaxed text-base-content/75">
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

          {meritsHeroSlot ? (
            <div className="min-w-0 rounded-xl border border-base-300/50 bg-base-100/75 p-5 shadow-sm backdrop-blur-sm lg:sticky lg:top-4 lg:col-span-4 lg:self-start">
              {meritsHeroSlot}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const ProfileHero = ProfileHeroComponent;
