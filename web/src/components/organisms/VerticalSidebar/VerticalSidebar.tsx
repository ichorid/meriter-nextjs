'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/api';
import { useCommunity } from '@/hooks/api';
import { Avatar } from '@/components/atoms';
import { routes } from '@/lib/constants/routes';

export interface VerticalSidebarProps {
  className?: string;
}

export const VerticalSidebar: React.FC<VerticalSidebarProps> = ({ className = '' }) => {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const { data: wallets = [] } = useWallets();

  // Get unique community IDs from wallets
  const communityIds = Array.from(new Set(
    wallets
      .filter((w: any) => w.communityId)
      .map((w: any) => w.communityId)
  ));

  // Don't show sidebar on login page
  if (pathname?.includes('/login')) {
    return null;
  }

  // Hide sidebar on mobile when viewing post details
  const isPostDetailPage = pathname?.includes('/posts/');

  return (
    <aside className={`fixed left-0 top-0 h-screen w-[72px] bg-base-200 border-r border-base-300 z-40 flex flex-col items-center py-4 ${isPostDetailPage ? 'hidden md:flex' : 'flex'} ${className}`}>
      {/* Home Icon */}
      <Link href={routes.home}>
        <button
          className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors mb-2 ${
            pathname === routes.home
              ? 'bg-primary text-primary-content'
              : 'hover:bg-base-300 text-base-content'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>
      </Link>

      <div className="flex-1 overflow-y-auto w-full px-2 py-2">
        {/* Community Avatars */}
        <div className="space-y-2">
          {isAuthenticated && communityIds.map((communityId: string) => (
            <CommunityAvatarLink key={communityId} communityId={communityId} pathname={pathname} />
          ))}
        </div>
      </div>

      {/* Settings Icon */}
      <Link href={routes.settings}>
        <button
          className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors mt-2 ${
            pathname === routes.settings
              ? 'bg-primary text-primary-content'
              : 'hover:bg-base-300 text-base-content'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </Link>
    </aside>
  );
};

// Helper component to fetch and display community avatar
const CommunityAvatarLink: React.FC<{ communityId: string; pathname: string | null }> = ({ communityId, pathname }) => {
  const { data: community } = useCommunity(communityId);
  const isActive = pathname?.includes(`/communities/${communityId}`);

  if (!community) {
    return null;
  }

  return (
    <Link href={`/meriter/communities/${communityId}`}>
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
          isActive
            ? 'ring-2 ring-primary ring-offset-2 ring-offset-base-200'
            : 'hover:ring-2 hover:ring-base-content/20'
        }`}
      >
        <Avatar
          src={community.avatarUrl}
          alt={community.name}
          size="md"
          className="rounded-full"
        />
      </div>
    </Link>
  );
};

