'use client';

import React, { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User, ChevronDown, ChevronUp } from 'lucide-react';
import { Users, FileText, Settings, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/constants/routes';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';

interface CommunityHeroCardProps {
  community: {
    id: string;
    name: string;
    description?: string;
    avatarUrl?: string;
    coverImageUrl?: string;
    memberCount?: number;
    publicationCount?: number;
    typeTag?: string;
    isAdmin?: boolean;
    needsSetup?: boolean;
    settings?: {
      iconUrl?: string;
    };
    futureVisionCover?: string;
    futureVisionText?: string;
    futureVisionTags?: string[];
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
  const { user } = useAuth();
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const t = useTranslations('pages.communitySettings');
  const tCommunities = useTranslations('pages.communities');
  const tCommon = useTranslations('common');

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
  const hasFutureVision =
    !!community.futureVisionText?.trim() ||
    (community.futureVisionTags && community.futureVisionTags.length > 0) ||
    !!obCover;
  const [obExpanded, setObExpanded] = useState(false);
  const tPages = useTranslations('pages');

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
              {community.publicationCount !== undefined && (
                <div className="flex items-center gap-1">
                  <FileText size={12} />
                  <span>{community.publicationCount}</span>
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

      {/* Avatar - overlapping cover */}
      <div className="relative px-4 sm:px-6">
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

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-base-content/60">
            {community.memberCount !== undefined && (
              <div className="flex items-center gap-1">
                <Users size={14} />
                <span>{community.memberCount}</span>
              </div>
            )}
            {community.publicationCount !== undefined && (
              <div className="flex items-center gap-1">
                <FileText size={14} />
                <span>{community.publicationCount}</span>
              </div>
            )}
          </div>

          {/* Future vision subsection (inside same block) */}
          {hasFutureVision && (
            <div className="mt-4 pt-4 border-t border-base-200 space-y-2">
              <h3 className="text-sm font-semibold text-base-content/80">
                {tPages('futureVisions')}
              </h3>
              {obCover && !obCoverUsedInHeader && (
                <div className="aspect-video w-full max-w-xl rounded-lg overflow-hidden bg-base-300">
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
                      className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-base-300 text-base-content/90"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

