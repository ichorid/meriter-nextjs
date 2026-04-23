'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User as UserIcon, Edit, Settings, ChevronDown, ChevronUp, Mail, Share2, MessageCircle } from 'lucide-react';
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
import { useMeriterStitchChrome } from '@/contexts/MeriterChromeContext';

/** Full-width action row under contacts (merit history, invite, transfer); subtle corners in stitch + default. */
export function profileHeroLeftStackActionClass(sc: boolean) {
  return cn(
    'inline-flex w-full min-w-0 max-w-full items-center justify-center gap-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 active:scale-[0.99] [&_svg]:shrink-0',
    sc
      ? 'rounded-xl border border-white/18 bg-white/[0.04] px-4 py-2.5 text-stitch-text/90 shadow-none hover:border-white/28 hover:bg-white/[0.08] hover:text-stitch-text focus-visible:ring-stitch-accent/35 [&_svg]:h-4 [&_svg]:w-4'
      : 'rounded-xl border border-base-300/55 bg-base-200/55 px-4 py-2.5 text-base-content shadow-sm hover:bg-base-300/60 focus-visible:ring-ring [&_svg]:h-4 [&_svg]:w-4',
  );
}

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
  /** Stacked actions under contacts / bio (merit history, invite, transfer). */
  heroLeftStackSlot?: React.ReactNode;
}

function ProfileHeroComponent({
  user,
  stats: _stats,
  showEdit = false,
  userRoles = [],
  onEdit,
  meritsHeroSlot,
  heroLeftStackSlot,
}: ProfileHeroProps) {
  const sc = useMeriterStitchChrome();
  const sectionCardClass = sc
    ? 'rounded-xl border-0 bg-stitch-surface2/90 py-4 px-4 sm:px-4 space-y-3'
    : 'rounded-xl border border-base-300/40 bg-base-100/50 backdrop-blur-sm py-4 px-4 sm:px-4 space-y-3';
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const tShared = useTranslations('shared');
  const router = useRouter();
  const [contactsExpanded, setContactsExpanded] = useLocalStorage<boolean>('profile.contactsExpanded', true);

  if (!user) return null;

  const displayName = user.displayName || user.username || tCommon('user');
  const avatarUrl = user.avatarUrl;
  const bio = user.profile?.bio;
  const website = user.profile?.website;
  const about = user.profile?.about;
  const educationalInstitution = user.profile?.educationalInstitution;
  const contacts = user.profile?.contacts;

  const isRepresentativeOrMember =
    user.globalRole === 'superadmin' || userRoles.some((r) => r.role === 'lead' || r.role === 'participant');

  const showContacts = user.globalRole === 'superadmin' || userRoles.some((r) => r.role === 'lead');

  const hasContactFields = Boolean(contacts?.email || contacts?.messenger);
  const messengerRaw = contacts?.messenger?.trim() ?? '';
  const messengerIsUrl = /^https?:\/\//i.test(messengerRaw);

  const contactInlineChipClass = cn(
    'inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
    sc
      ? 'bg-white/[0.06] text-stitch-text hover:bg-white/[0.1]'
      : 'bg-base-200/60 text-base-content hover:bg-base-200',
  );

  const stitchContactRow =
    sc && showContacts && hasContactFields && contacts ? (
      <div className="flex flex-wrap items-center gap-2">
        {contacts.email ? (
          <a href={`mailto:${contacts.email}`} className={contactInlineChipClass} title={contacts.email}>
            <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            <span className="truncate">{contacts.email}</span>
          </a>
        ) : null}
        {messengerRaw ? (
          messengerIsUrl ? (
            <a
              href={messengerRaw}
              target="_blank"
              rel="noopener noreferrer"
              className={contactInlineChipClass}
              title={messengerRaw}
            >
              <MessageCircle className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="truncate max-w-[220px]">{messengerRaw.replace(/^https?:\/\//, '')}</span>
            </a>
          ) : (
            <span className={cn(contactInlineChipClass, 'cursor-default')} title={messengerRaw}>
              <MessageCircle className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="truncate max-w-[220px]">{messengerRaw}</span>
            </span>
          )
        ) : null}
      </div>
    ) : null;

  const handleShareProfile = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hapticImpact('light');
    trackMeriterUiEvent({ name: 'profile_share' });
    await shareUrl(getProfileUrl(user.id), tShared('urlCopiedToBuffer'));
  };

  const selfSummary = [about?.trim(), bio?.trim()].find(Boolean) ?? '';

  const actionBtnClass = sc
    ? 'h-8 rounded-xl border-0 bg-white/[0.06] px-3 text-stitch-text shadow-none backdrop-blur-sm hover:bg-white/[0.1] active:scale-[0.98]'
    : 'h-8 rounded-xl border border-base-300/30 bg-base-100/85 px-3 text-base-content/80 shadow-sm backdrop-blur-sm hover:bg-base-100 active:scale-[0.98]';

  return (
    <div
      className={cn(
        'relative mb-6 overflow-hidden rounded-2xl',
        sc ? 'border-0 bg-stitch-surface shadow-none' : 'border border-base-300/50 bg-base-200/15 shadow-sm',
      )}
    >
      {!sc ? (
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
                  className={actionBtnClass}
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
      ) : (
        <div className="relative h-14 bg-gradient-to-r from-stitch-accent/12 via-transparent to-transparent sm:h-16">
          <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
            {showEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  trackMeriterUiEvent({ name: 'profile_edit_open' });
                  if (onEdit) onEdit();
                  else router.push('/meriter/profile/edit');
                }}
                className={actionBtnClass}
              >
                <Edit size={14} className="mr-1.5" />
                <span className="text-xs font-medium">{tCommon('edit')}</span>
              </Button>
            )}
            <button
              type="button"
              onClick={handleShareProfile}
              className="flex-shrink-0 rounded-full border-0 bg-white/[0.06] p-2 text-stitch-muted transition-colors hover:bg-white/[0.1] hover:text-stitch-text"
              aria-label={tShared('share')}
              title={tShared('share')}
            >
              <Share2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <div className={cn('relative z-10 px-4 pb-6 sm:px-6', sc ? 'pt-5' : '-mt-10')}>
        <div
          className={cn(
            'grid gap-6',
            /* xl: sidebar + padding leaves too little width at lg for col-span-4 merits card */
            meritsHeroSlot ? 'grid-cols-1 xl:grid-cols-12 xl:items-start' : 'grid-cols-1',
          )}
        >
          <div className={cn('min-w-0 space-y-4', meritsHeroSlot && 'xl:col-span-8')}>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-start sm:gap-6">
              <div className="shrink-0">
                <Avatar
                  className={cn(
                    meritsHeroSlot
                      ? 'h-28 w-28 rounded-2xl sm:h-[5.5rem] sm:w-[5.5rem]'
                      : 'h-20 w-20 rounded-2xl',
                    sc
                      ? 'border-4 border-stitch-canvas bg-stitch-surface2 text-xl shadow-lg ring-1 ring-stitch-border/80'
                      : 'border-4 border-base-100 bg-base-200 text-xl shadow-lg ring-2 ring-base-300/25',
                  )}
                >
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback userId={user.id} className="rounded-2xl font-medium uppercase">
                    {displayName ? displayName.slice(0, 2).toUpperCase() : <UserIcon size={32} />}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            <div>
              <h1
                className={cn(
                  'text-2xl font-bold tracking-tight sm:text-3xl',
                  sc ? 'text-stitch-text' : 'text-base-content',
                )}
              >
                {displayName}
              </h1>
              {user.username && (
                <p className={cn('mt-1 text-sm font-medium', sc ? 'text-stitch-muted' : 'text-base-content/50')}>
                  @{user.username}
                </p>
              )}
            </div>

            {stitchContactRow && !selfSummary ? <div className="mt-2">{stitchContactRow}</div> : null}

            {selfSummary ? (
              <p className={cn('text-sm leading-relaxed', sc ? 'text-stitch-muted' : 'text-base-content/80')}>
                {selfSummary}
              </p>
            ) : null}

            {website ? (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-block text-sm transition-colors hover:underline',
                  selfSummary ? 'mt-1.5' : null,
                  sc ? 'text-stitch-accent hover:text-stitch-accent' : 'text-primary/90 hover:text-primary',
                )}
              >
                {website.replace(/^https?:\/\//, '')}
              </a>
            ) : null}

            {stitchContactRow && selfSummary ? <div className="mt-2">{stitchContactRow}</div> : null}

            {heroLeftStackSlot ? (
              <div className="mt-3 flex w-full min-w-0 flex-col gap-2 sm:max-w-md">{heroLeftStackSlot}</div>
            ) : null}

            {isRepresentativeOrMember && educationalInstitution && (
              <>
                {selfSummary ? (
                  <Separator className={cn('my-1', sc ? 'bg-stitch-border' : 'bg-base-300/60')} />
                ) : null}
                <div className={sectionCardClass}>
                  <p
                    className={cn(
                      'mb-1 text-xs font-semibold uppercase tracking-wide',
                      sc ? 'text-stitch-muted' : 'text-base-content/45',
                    )}
                  >
                    {t('educationalInstitution')}
                  </p>
                  <p className={cn('text-sm', sc ? 'text-stitch-text/90' : 'text-base-content/75')}>
                    {educationalInstitution}
                  </p>
                </div>
              </>
            )}

            {showContacts && contacts && (contacts.email || contacts.messenger) && !sc && (
              <>
                {(selfSummary || (isRepresentativeOrMember && educationalInstitution)) ? (
                  <Separator className={cn('my-1', sc ? 'bg-stitch-border' : 'bg-base-300/60')} />
                ) : null}
                <div className={sectionCardClass}>
                  <button
                    type="button"
                    onClick={() => setContactsExpanded(!contactsExpanded)}
                    className="flex w-full items-center justify-between transition-opacity hover:opacity-90"
                  >
                    <p
                      className={cn(
                        'text-xs font-semibold uppercase tracking-wide',
                        sc ? 'text-stitch-muted' : 'text-base-content/45',
                      )}
                    >
                      {t('contacts')}
                    </p>
                    {contactsExpanded ? (
                      <ChevronUp className={cn('h-4 w-4', sc ? 'text-stitch-muted' : 'text-base-content/40')} />
                    ) : (
                      <ChevronDown className={cn('h-4 w-4', sc ? 'text-stitch-muted' : 'text-base-content/40')} />
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
            <div
              className={cn(
                'min-w-0 overflow-hidden rounded-xl p-5 xl:sticky xl:top-4 xl:col-span-4 xl:self-start',
                sc
                  ? 'border-0 bg-stitch-surface2/90 shadow-none'
                  : 'border border-base-300/50 bg-base-100/75 shadow-sm backdrop-blur-sm',
              )}
            >
              {meritsHeroSlot}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const ProfileHero = ProfileHeroComponent;
