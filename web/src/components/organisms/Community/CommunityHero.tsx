'use client';

import React from 'react';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { Users, FileText, TrendingUp } from 'lucide-react';

interface CommunityHeroProps {
  community: {
    id: string;
    name: string;
    description?: string;
    avatarUrl?: string;
  };
  stats?: {
    publications: number;
    members?: number;
    activity?: number;
  };
}

export function CommunityHero({ community, stats }: CommunityHeroProps) {
  const { name, description, avatarUrl } = community;

  return (
    <div className="relative bg-base-100 rounded-2xl overflow-hidden border border-base-content/5">
      {/* Cover Section - reduced height */}
      <div className="relative h-20 bg-gradient-to-br from-base-content/5 via-base-content/3 to-transparent" />

      {/* Community Content */}
      <div className="relative px-5 pb-5">
        {/* Avatar Section - positioned to overlap cover */}
        <div className="-mt-8 mb-3">
          <BrandAvatar
            src={avatarUrl}
            fallback={name}
            size="lg"
            className="border-4 border-base-100 shadow-md bg-base-200"
          />
        </div>

        {/* Community Info */}
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-base-content break-words">
            {name}
          </h1>
          {description && (
            <p className="text-sm text-base-content/60 leading-relaxed break-words">
              {description}
            </p>
          )}
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="mt-5 pt-4 border-t border-base-content/5">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <FileText size={16} className="text-base-content/40 mx-auto mb-1" />
                <div className="text-lg font-semibold text-base-content">
                  {stats.publications}
                </div>
                <div className="text-xs text-base-content/50">
                  Publications
                </div>
              </div>
              {stats.members !== undefined && (
                <a
                  href={`/meriter/communities/${community.id}/members`}
                  className="text-center hover:bg-base-content/5 rounded-lg p-2 -m-2 transition-colors"
                >
                  <Users size={16} className="text-base-content/40 mx-auto mb-1" />
                  <div className="text-lg font-semibold text-base-content">
                    {stats.members}
                  </div>
                  <div className="text-xs text-base-content/50">
                    Members
                  </div>
                </a>
              )}
              {stats.activity !== undefined ? (
                <div className="text-center">
                  <TrendingUp size={16} className="text-base-content/40 mx-auto mb-1" />
                  <div className="text-lg font-semibold text-base-content">
                    {stats.activity}
                  </div>
                  <div className="text-xs text-base-content/50">
                    Activity
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <TrendingUp size={16} className="text-base-content/40 mx-auto mb-1" />
                  <div className="text-lg font-semibold text-base-content/30">
                    —
                  </div>
                  <div className="text-xs text-base-content/50">
                    Activity
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

