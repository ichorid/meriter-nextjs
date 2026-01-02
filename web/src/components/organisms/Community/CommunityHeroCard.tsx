'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User } from 'lucide-react';
import { Users, FileText, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/constants/routes';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('pages.communitySettings');
  const tCommon = useTranslations('common');

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
  const hasCoverImage = !!community.coverImageUrl;

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
      {/* Cover Image / Gradient Background */}
      <div
        className={`relative h-32 sm:h-40 ${!hasCoverImage ? `bg-gradient-to-r ${gradientFrom} ${gradientTo}` : ''}`}
        style={hasCoverImage ? { backgroundImage: `url(${community.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {/* Overlay for better text visibility */}
        <div className="absolute inset-0 bg-black/20" />

        {/* Settings button for admins */}
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
            <p className="text-sm text-base-content/70 mb-3">
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
        </div>
      </div>
    </div>
  );
};

