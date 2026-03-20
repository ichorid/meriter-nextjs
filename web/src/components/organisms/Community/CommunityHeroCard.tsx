'use client';

import React, { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User, ChevronDown, ChevronUp } from 'lucide-react';
import { Users, Settings, Trash2, TrendingUp, ArrowUp } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { routes } from '@/lib/constants/routes';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { Button } from '@/components/ui/shadcn/button';
import { formatMerits } from '@/lib/utils/currency';
import { useUIStore } from '@/stores/ui.store';

interface CommunityHeroCardProps {
  community: {
    id: string;
    name: string;
    description?: string;
    avatarUrl?: string;
    coverImageUrl?: string;
    memberCount?: number;
    typeTag?: string;
    isAdmin?: boolean;
    needsSetup?: boolean;
    settings?: {
      iconUrl?: string;
    };
    futureVisionCover?: string;
    futureVisionText?: string;
    futureVisionTags?: string[];
    /** Linked OB publication in the future-vision community (from getById) */
    futureVisionPublicationId?: string;
    futureVisionPublicationScore?: number;
  };
  className?: string;
  /** Compact mode for embedding in other pages */
  isCompact?: boolean;
  /** Click handler - if provided, card becomes clickable */
  onClick?: () => void;
}

/**
 * Twitter-style community hero card with cover image, avatar, and info
 */
export const CommunityHeroCard: React.FC<CommunityHeroCardProps> = ({
  community,
  className = '',
  isCompact = false,
  onClick,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const tCommunities = useTranslations('pages.communities');
  const tCommon = useTranslations('common');
  const tShared = useTranslations('shared');
  const openVotingPopup = useUIStore((s) => s.openVotingPopup);

  // Check if user is a lead (for deleted button visibility)
  const isLead = user?.globalRole === 'superadmin' ||
    !!userRoles.find((r) => r.communityId === community.id && r.role === 'lead');

  // Generate a gradient background based on community name if no cover image
  const generateGradient = (name: string): [string, string] => {
    const colors: [string, string][] = [
      ['from-blue-600', 'to-purple-600'],
      ['from-emerald-500', 'to-teal-600'],
      ['from-orange-500', 'to-red-600'],
      ['from-pink-500', 'to-rose-600'],
      ['from-indigo-500', 'to-blue-600'],
      ['from-amber-500', 'to-orange-600'],
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index] ?? ['from-blue-600', 'to-purple-600'];
  };

  const [gradientFrom, gradientTo] = generateGradient(community.name);
  const obCover = community.futureVisionCover;
  const headerImageUrl = obCover || community.coverImageUrl;
  const hasCoverImage = !!headerImageUrl;
  const obCoverUsedInHeader = !!obCover;
  const showFutureVisionSubsection =
    (!!obCover && !obCoverUsedInHeader) ||
    !!community.futureVisionText?.trim() ||
    (community.futureVisionTags && community.futureVisionTags.length > 0);
  const [obExpanded, setObExpanded] = useState(false);

  const obPublicationId = community.futureVisionPublicationId;
  const obScore = community.futureVisionPublicationScore ?? 0;

  const handleObRatingClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!obPublicationId || !pathname) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('post', obPublicationId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleObSupportClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!obPublicationId) return;
    openVotingPopup(obPublicationId, 'publication', 'wallet-only');
  };

  // Compact mode renders a simpler, smaller card
  if (isCompact) {
    return (
      <div
        className={`bg-base-100 rounded-xl overflow-hidden shadow-none ${onClick ? 'cursor-pointer hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] hover:scale-[1.01] transition-all duration-300' : ''} ${className}`}
        onClick={onClick}
      >
        <div className="flex items-center gap-3 p-3">
          <Avatar className="w-10 h-10 text-sm flex-shrink-0">
            {community.avatarUrl && (
              <AvatarImage src={community.avatarUrl} alt={community.name} />
            )}
            <AvatarFallback communityId={community.id} className="font-medium uppercase">
              {community.name ? community.name.slice(0, 2).toUpperCase() : <User size={18} />}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-base-content truncate">
                {community.name}
              </h3>
              {community.settings?.iconUrl && (
                <img
                  src={community.settings.iconUrl}
                  alt=""
                  className="w-4 h-4 flex-shrink-0"
                />
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-base-content/60">
              {community.memberCount !== undefined && (
                <div className="flex items-center gap-1">
                  <Users size={12} />
                  <span>{community.memberCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-base-100 rounded-xl overflow-hidden shadow-none ${onClick ? 'cursor-pointer hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] hover:scale-[1.01] transition-all duration-300' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Cover Image / Gradient Background (OB cover preferred when present) */}
      <div
        className={`relative h-28 sm:h-36 ${!hasCoverImage ? `bg-gradient-to-r ${gradientFrom} ${gradientTo}` : ''}`}
        style={hasCoverImage ? { backgroundImage: `url(${headerImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {/* Overlay for better text visibility */}
        <div className="absolute inset-0 bg-black/20" />

        {/* Settings button for admins - rightmost */}
        {community.isAdmin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(routes.communitySettings(community.id));
            }}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors backdrop-blur-sm"
            title={tCommon('settings')}
          >
            <Settings size={18} className="text-white" />
          </button>
        )}

        {/* Members button - positioned based on which buttons are visible */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(routes.communityMembers(community.id));
          }}
          className={`absolute top-3 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors backdrop-blur-sm ${
            community.isAdmin
              ? 'right-[51px]'
              : 'right-3'
          }`}
          title={tCommunities('members.title')}
        >
          <Users size={18} className="text-white" />
        </button>

        {/* Deleted button for leads/superadmins - left of Members */}
        {isLead && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(routes.communityDeleted(community.id));
            }}
            className={`absolute top-3 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors backdrop-blur-sm ${
              community.isAdmin
                ? 'right-[102px]'
                : 'right-[51px]'
            }`}
            aria-label={tCommunities('deleted')}
            title={tCommunities('deleted')}
          >
            <Trash2 size={18} className="text-white" />
          </button>
        )}

        {/* Setup badge */}
        {community.needsSetup && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-warning text-warning-content text-xs font-medium">
            {tCommon('needsSetup')}
          </div>
        )}
      </div>

      {/* Avatar - overlapping cover (px-4 matches member/projects teaser tiles p-4) */}
      <div className="relative px-4">
        <div className="-mt-12 sm:-mt-14 mb-3 relative z-10">
          <div className="relative inline-block ring-4 ring-base-100 rounded-full bg-base-100">
            <Avatar className="w-20 h-20 sm:w-24 sm:h-24 text-xl bg-base-200">
              {community.avatarUrl && (
                <AvatarImage src={community.avatarUrl} alt={community.name} />
              )}
              <AvatarFallback communityId={community.id} className="font-medium uppercase">
                {community.name ? community.name.slice(0, 2).toUpperCase() : <User size={32} />}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Community Info */}
        <div className="pb-4 relative z-0">
          {/* Name and currency icon */}
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-base-content">
              {community.name}
            </h1>
            {community.settings?.iconUrl && (
              <img
                src={community.settings.iconUrl}
                alt=""
                className="w-5 h-5 sm:w-6 sm:h-6"
              />
            )}
          </div>

          {/* Description */}
          {community.description && (
            <p className="text-sm text-base-content/70 mb-3 line-clamp-2">
              {community.description}
            </p>
          )}

          {/* Future vision: single inset card (members count is on the cover toolbar) */}
          {showFutureVisionSubsection && (
            <div className="mt-4">
              <div className="rounded-xl border border-base-300/70 bg-base-200/35 dark:bg-base-300/25 px-4 py-4 sm:px-5 sm:py-4 space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
                  {tCommunities('futureVisionSectionTitle')}
                </h2>

                {obCover && !obCoverUsedInHeader && (
                  <div className="aspect-video w-full max-w-xl rounded-lg overflow-hidden bg-base-300/80">
                    <img
                      src={obCover}
                      alt=""
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                {community.futureVisionText?.trim() && (
                  <>
                    <p
                      className={`text-sm text-base-content/90 whitespace-pre-wrap ${obExpanded ? '' : 'line-clamp-3'}`}
                    >
                      {community.futureVisionText.trim()}
                    </p>
                    {community.futureVisionText.trim().length > 180 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setObExpanded((v) => !v);
                        }}
                        className="text-primary text-sm font-medium hover:underline flex items-center gap-1"
                      >
                        {obExpanded ? (
                          <>
                            <ChevronUp size={14} />
                            {tCommunities('showLess')}
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} />
                            {tCommunities('showMore')}
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
                {community.futureVisionTags && community.futureVisionTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {community.futureVisionTags.map((tag: string) => (
                      <span
                        key={tag}
                        className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-base-300/90 dark:bg-base-300/50 text-base-content/90"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {obPublicationId && (
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-0.5">
                    <button
                      type="button"
                      onClick={handleObRatingClick}
                      className="flex items-center gap-1.5 text-sm hover:bg-base-300/50 dark:hover:bg-base-300/40 rounded-lg px-2 py-1.5 transition-colors group flex-shrink-0"
                      title={tShared('totalVotesTooltip', { defaultValue: 'Total votes including withdrawn' })}
                      aria-label={tCommunities('futureVisionOpenSupporters')}
                    >
                      <TrendingUp className="w-4 h-4 text-base-content/50 group-hover:text-base-content/70 flex-shrink-0" />
                      <span
                        className={`font-medium tabular-nums ${
                          obScore > 0
                            ? 'text-success'
                            : obScore < 0
                              ? 'text-error'
                              : 'text-base-content/60'
                        }`}
                      >
                        {obScore > 0 ? '+' : ''}
                        {formatMerits(obScore)}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg px-2.5 text-xs shrink-0 border-base-300 bg-base-100/80"
                      onClick={handleObSupportClick}
                      aria-label={tCommon('support', { defaultValue: 'Support' })}
                    >
                      <ArrowUp className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="whitespace-nowrap">{tCommon('support', { defaultValue: 'Support' })}</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
