'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCommunity, useWallets } from '@/hooks/api';
import { useUserQuota } from '@/hooks/api/useQuota';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export interface ContextTopBarProps {
  className?: string;
}

export const ContextTopBar: React.FC<ContextTopBarProps> = ({ className = '' }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations('home');

  // Don't show on login page
  if (pathname?.includes('/login')) {
    return null;
  }

  // Determine which content to show based on route
  const isHomePage = pathname === '/meriter/home';
  const isSettingsPage = pathname === '/meriter/settings';
  const isCommunityPage = pathname?.match(/\/meriter\/communities\/([^\/]+)$/);
  const isPostDetailPage = pathname?.match(/\/meriter\/communities\/([^\/]+)\/posts\/(.+)/);

  if (isPostDetailPage) {
    return <PostDetailTopBar pathname={pathname} className={className} />;
  }

  if (isCommunityPage) {
    const communityId = isCommunityPage[1];
    if (!communityId) return null;
    return <CommunityTopBar communityId={communityId} className={className} />;
  }

  if (isHomePage) {
    return <HomeTopBar className={className} />;
  }

  if (isSettingsPage) {
    return <SettingsTopBar className={className} />;
  }

  // Default top bar
  return (
    <header className={`sticky top-0 z-30 h-16 bg-base-100 shadow-md ${className}`}>
      <div className="px-4 h-full flex items-center">
        <h1 className="text-xl font-semibold">Meriter</h1>
      </div>
    </header>
  );
};

// Home Top Bar with Tabs
const HomeTopBar: React.FC<{ className?: string }> = ({ className }) => {
  const pathname = usePathname();
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const t = useTranslations('home');

  const [activeTab, setActiveTab] = React.useState<'publications' | 'comments' | 'polls' | 'updates'>('publications');
  const [sortBy, setSortBy] = React.useState<'recent' | 'voted'>('recent');

  React.useEffect(() => {
    // Parse hash for tab
    if (hash.includes('comments')) {
      setActiveTab('comments');
    } else if (hash.includes('polls')) {
      setActiveTab('polls');
    } else if (hash.includes('updates')) {
      setActiveTab('updates');
    } else {
      setActiveTab('publications');
    }

    // Parse hash for sort
    const urlParams = new URLSearchParams(hash.replace(/^#/, '').split('?')[1] || '');
    const sortParam = urlParams.get('sort');
    if (sortParam === 'voted') {
      setSortBy('voted');
    } else {
      setSortBy('recent');
    }
  }, [hash]);

  const handleTabClick = (tab: 'publications' | 'comments' | 'polls' | 'updates') => {
    setActiveTab(tab);
    let hashPart = '';
    if (tab === 'comments') {
      hashPart = '#comments';
    } else if (tab === 'polls') {
      hashPart = '#polls';
    } else if (tab === 'updates') {
      hashPart = '#updates-frequency';
    }

    const urlParams = new URLSearchParams();
    urlParams.set('sort', sortBy);
    window.location.hash = hashPart ? `${hashPart}?${urlParams.toString()}` : '';
  };

  const handleSortClick = (sort: 'recent' | 'voted') => {
    setSortBy(sort);
    const urlParams = new URLSearchParams();
    urlParams.set('sort', sort);
    
    let hashPart = window.location.hash.split('?')[0];
    if (hashPart === '#comments') {
      hashPart = '#comments';
    } else if (hashPart === '#polls') {
      hashPart = '#polls';
    } else if (hashPart === '#updates-frequency') {
      hashPart = '#updates-frequency';
    } else {
      hashPart = '';
    }
    
    window.location.hash = hashPart ? `${hashPart}?${urlParams.toString()}` : `?${urlParams.toString()}`;
  };

  return (
    <header className={`sticky top-0 z-30 h-16 bg-base-100 shadow-md ${className}`}>
      <div className="px-4 h-full flex items-center gap-2">
        <h1 className="text-xl font-semibold mr-4">Home</h1>
        <div className="flex gap-1 bg-base-200 rounded-lg p-1">
          <button
            onClick={() => handleTabClick('publications')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'publications'
                ? 'bg-primary text-primary-content'
                : 'hover:bg-base-300 text-base-content'
            }`}
          >
            {t('tabs.publications')}
          </button>
          <button
            onClick={() => handleTabClick('comments')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'comments'
                ? 'bg-primary text-primary-content'
                : 'hover:bg-base-300 text-base-content'
            }`}
          >
            {t('tabs.comments')}
          </button>
          <button
            onClick={() => handleTabClick('polls')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'polls'
                ? 'bg-primary text-primary-content'
                : 'hover:bg-base-300 text-base-content'
            }`}
          >
            {t('tabs.polls')}
          </button>
          <button
            onClick={() => handleTabClick('updates')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'updates'
                ? 'bg-primary text-primary-content'
                : 'hover:bg-base-300 text-base-content'
            }`}
          >
            {t('tabs.updates')}
          </button>
        </div>
        <div className="ml-auto join shadow-sm">
          <button 
            onClick={() => handleSortClick('recent')}
            className={`join-item btn btn-sm font-medium transition-all duration-200 ${
              sortBy === 'recent' ? 'btn-active btn-primary' : ''
            }`}
          >
            {t('sort.recent')}
          </button>
          <button 
            onClick={() => handleSortClick('voted')}
            className={`join-item btn btn-sm font-medium transition-all duration-200 ${
              sortBy === 'voted' ? 'btn-active btn-primary' : ''
            }`}
          >
            {t('sort.voted')}
          </button>
        </div>
      </div>
    </header>
  );
};

// Community Top Bar
const CommunityTopBar: React.FC<{ communityId: string; className?: string }> = ({ communityId, className }) => {
  const { data: community } = useCommunity(communityId);
  const { user } = useAuth();
  const { data: wallets = [] } = useWallets();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('pages.communities');
  const [showTagDropdown, setShowTagDropdown] = React.useState(false);

  // Get wallet balance for this community
  const wallet = wallets.find((w: any) => w.communityId === communityId);
  const balance = wallet?.balance || 0;

  // Get free vote quota using standardized hook
  const { data: quota, error: quotaError } = useUserQuota(community?.id);


  // Get sortBy from URL params
  const sortBy = searchParams.get('sort') || 'recent';
  const selectedTag = searchParams.get('tag');

  // Handle sort change
  const handleSortChange = (sort: 'recent' | 'voted') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', sort);
    router.push(`?${params.toString()}`);
  };

  // Handle tag filter
  const handleTagClick = (tag: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedTag === tag) {
      params.delete('tag');
    } else {
      params.set('tag', tag);
    }
    router.push(`?${params.toString()}`);
    setShowTagDropdown(false);
  };

  // Handle create poll - set modal state via URL param
  const handleCreatePoll = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('modal', 'createPoll');
    router.push(`?${params.toString()}`);
  };

  if (!community) {
    return null;
  }

  const hashtags = community.hashtags || [];

  return (
    <header className={`sticky top-0 z-30 h-16 bg-base-100 shadow-md ${className}`}>
      <div className="px-4 h-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{community.name}</h1>
          {community.isAdmin && (
            <button
              onClick={() => router.push(`/meriter/communities/${communityId}/settings`)}
              className="btn btn-ghost btn-sm btn-circle"
              title="Community Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          {/* Create Poll Button */}
          <button
            onClick={handleCreatePoll}
            className="btn btn-ghost btn-sm btn-circle"
            title={t('createPoll')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Tag Filter Dropdown */}
          {hashtags.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                className="btn btn-sm btn-ghost flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>{selectedTag ? `#${selectedTag}` : t('filterByTags')}</span>
              </button>
              
              {showTagDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowTagDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-64 max-h-96 overflow-y-auto bg-base-100 shadow-lg rounded-lg border border-base-300 p-3 z-20">
                    <div className="flex flex-wrap gap-2">
                      {hashtags.map((tag: string) => (
                        <button
                          key={tag}
                          onClick={() => handleTagClick(tag)}
                          className={`btn btn-xs ${
                            selectedTag === tag ? 'btn-primary' : 'btn-ghost'
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sort Toggle */}
          <div className="join shadow-sm">
            <button 
              onClick={() => handleSortChange('recent')}
              className={`join-item btn btn-sm font-medium transition-all duration-200 ${
                sortBy === 'recent' ? 'btn-active btn-primary' : ''
              }`}
            >
              {t('byDate')}
            </button>
            <button 
              onClick={() => handleSortChange('voted')}
              className={`join-item btn btn-sm font-medium transition-all duration-200 ${
                sortBy === 'voted' ? 'btn-active btn-primary' : ''
              }`}
            >
              {t('byRating')}
            </button>
          </div>

          {/* Balance and Quota */}
          <div className="flex items-center gap-2 text-sm">
            {community.settings?.iconUrl && (
              <img src={community.settings.iconUrl} alt="Currency" className="w-5 h-5" />
            )}
            <span className="font-semibold">{balance}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="opacity-60">Quota:</span>
            <span className="font-semibold">
              {quotaError 
                ? '-' 
                : (quota && typeof quota.remainingToday === 'number' ? quota.remainingToday : 0)
              }
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

// Settings Top Bar
const SettingsTopBar: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <header className={`sticky top-0 z-30 h-16 bg-base-100 shadow-md ${className}`}>
      <div className="px-4 h-full flex items-center">
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>
    </header>
  );
};

// Post Detail Top Bar with Back Button
const PostDetailTopBar: React.FC<{ pathname: string; className?: string }> = ({ pathname, className }) => {
  const router = useRouter();
  
  // Extract community ID from pathname
  const match = pathname.match(/\/meriter\/communities\/([^\/]+)\/posts\/(.+)/);
  const communityId = match?.[1];

  const { data: community } = useCommunity(communityId || '');

  const handleBack = () => {
    router.back();
  };

  return (
    <header className={`sticky top-0 z-30 h-16 bg-base-100 shadow-md ${className}`}>
      <div className="px-4 h-full flex items-center gap-3">
        {/* Mobile back button */}
        <button
          onClick={handleBack}
          className="md:hidden btn btn-ghost btn-sm btn-circle"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {community && (
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{community.name}</h1>
          </div>
        )}
      </div>
    </header>
  );
};

