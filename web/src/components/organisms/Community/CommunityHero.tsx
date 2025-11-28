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
    <div className="relative bg-white rounded-xl overflow-hidden border border-brand-secondary/10 shadow-sm">
      {/* Cover Image Section */}
      <div className="relative h-32 bg-gradient-to-r from-brand-primary/20 via-brand-primary/10 to-brand-secondary/10">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/30 to-transparent" />
      </div>

      {/* Community Content */}
      <div className="relative px-4 pb-6 pt-2">
        {/* Avatar Section */}
        <div className="flex items-end justify-between -mt-16 mb-4">
          <div className="relative">
            <BrandAvatar
              src={avatarUrl}
              fallback={name}
              size="xl"
              className="border-4 border-white shadow-lg bg-white"
            />
          </div>
        </div>

        {/* Community Info */}
        <div className="mt-4 space-y-2">
          <div>
            <h1 className="text-2xl font-bold text-brand-text-primary">
              {name}
            </h1>
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm text-brand-text-primary leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="mt-6 pt-6 border-t border-brand-secondary/10">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <FileText size={18} className="text-brand-text-secondary mr-1" />
                </div>
                <div className="text-2xl font-bold text-brand-text-primary">
                  {stats.publications}
                </div>
                <div className="text-xs text-brand-text-secondary mt-1">
                  Publications
                </div>
              </div>
              {stats.members !== undefined && (
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <Users size={18} className="text-brand-text-secondary mr-1" />
                  </div>
                  <div className="text-2xl font-bold text-brand-text-primary">
                    {stats.members}
                  </div>
                  <div className="text-xs text-brand-text-secondary mt-1">
                    Members
                  </div>
                </div>
              )}
              {stats.activity !== undefined ? (
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <TrendingUp size={18} className="text-brand-text-secondary mr-1" />
                  </div>
                  <div className="text-2xl font-bold text-brand-text-primary">
                    {stats.activity}
                  </div>
                  <div className="text-xs text-brand-text-secondary mt-1">
                    Activity
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-2xl font-bold text-brand-text-primary">
                    -
                  </div>
                  <div className="text-xs text-brand-text-secondary mt-1">
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

