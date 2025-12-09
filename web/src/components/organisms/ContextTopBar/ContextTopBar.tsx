'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCommunity, useWallets } from '@/hooks/api';
import { useUserQuota } from '@/hooks/api/useQuota';
import { useTranslations } from 'next-intl';
import { isFakeDataMode } from '@/config';
import { publicationsApiV1 } from '@/lib/api/v1';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandInput } from '@/components/ui/BrandInput';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { Clock, TrendingUp, Loader2, Search, X, ArrowLeft } from 'lucide-react';
import { useProfileTabState } from '@/hooks/useProfileTabState';
import type { TabSortState } from '@/hooks/useProfileTabState';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export interface ContextTopBarProps {
  className?: string;
}

export const ContextTopBar: React.FC<ContextTopBarProps> = () => {
  const pathname = usePathname();

  // Don't show on login page
  if (pathname?.includes('/login')) {
    return null;
  }

  // Determine which content to show based on route
  const isProfileMainPage = pathname === '/meriter/profile';
  const isProfileSubPage = pathname?.startsWith('/meriter/profile/');
  const isSettingsPage = pathname === '/meriter/settings';
  const isCommunityPage = pathname?.match(/\/meriter\/communities\/([^\/]+)$/);
  const isPostDetailPage = pathname?.match(/\/meriter\/communities\/([^\/]+)\/posts\/(.+)/);

  if (isPostDetailPage) {
    return null; // PostDetailTopBar was empty
  }

  if (isCommunityPage) {
    const communityId = isCommunityPage[1];
    if (!communityId) return null;
    return <CommunityTopBar communityId={communityId} />;
  }

  // Only show ProfileTopBar on sub-pages (publications, comments, polls), not on main profile page
  if (isProfileSubPage) {
    return <ProfileTopBar />;
  }

  if (isProfileMainPage) {
    return null; // Main profile page doesn't need top bar
  }

  if (isSettingsPage) {
    return null; // SettingsTopBar was empty
  }

  // Default top bar - empty, no header
  return null;
};

// Profile Top Bar with Tabs
const ProfileTopBar: React.FC = () => {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showSearchModal, setShowSearchModal] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Determine current tab from pathname
  const currentTab = pathname?.includes('/profile/comments') 
    ? 'comments' 
    : pathname?.includes('/profile/polls') 
    ? 'polls' 
    : pathname?.includes('/profile/projects')
    ? 'projects'
    : 'publications';
  
  const { sortByTab, setSortByTab } = useProfileTabState();
  
  // Sync sort from URL params
  React.useEffect(() => {
    const sortParam = searchParams?.get('sort');
    if (sortParam === 'voted' || sortParam === 'recent') {
      setSortByTab((prev) => ({
        ...prev,
        [currentTab]: sortParam,
      }));
    }
  }, [searchParams, currentTab, setSortByTab]);

  const handleBackClick = () => {
    router.push('/meriter/profile');
  };

  const handleSortClick = (sort: 'recent' | 'voted') => {
    // Update sort for the current active tab
    setSortByTab((prev: TabSortState) => ({
      ...prev,
      [currentTab]: sort,
    }));

    const basePath = '/meriter/profile';
    const tabPath = currentTab === 'publications' ? basePath : `${basePath}/${currentTab}`;
    
    const urlParams = new URLSearchParams();
    urlParams.set('sort', sort);
    
    router.push(`${tabPath}?${urlParams.toString()}`);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      router.push(`/meriter/search?q=${encodeURIComponent(value.trim())}`);
      setShowSearchModal(false);
    }
  };

  const handleSearchClear = () => {
    setSearchQuery('');
  };

  return (
    <div className="flex-shrink-0">
      <div className="sticky top-0 z-30 h-14 bg-base-100/95 backdrop-blur-md border-b border-brand-border px-4 py-2 w-full">
        <div className="flex items-center justify-between h-full gap-4">
          {/* Back Button */}
          <BrandButton
            variant="ghost"
            size="sm"
            onClick={handleBackClick}
            aria-label="Back to profile"
            className="px-2"
          >
            <ArrowLeft size={18} />
          </BrandButton>

          {/* Search Button */}
          <BrandButton
            variant="ghost"
            size="sm"
            onClick={() => setShowSearchModal(true)}
            aria-label="Search"
            className="px-2"
          >
            <Search size={18} />
          </BrandButton>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Sort Toggle - contextual to active tab */}
          <div className="flex gap-1 bg-brand-surface p-1 rounded-md border border-brand-border">
          <button
            onClick={() => handleSortClick('recent')}
            className={`p-2 rounded-md transition-colors ${sortByTab[currentTab] === 'recent'
                ? 'bg-base-100 text-brand-primary shadow-sm [data-theme="dark"]:bg-base-200 [data-theme="dark"]:shadow-[0_1px_2px_0_rgba(255,255,255,0.1)]'
                : 'text-brand-text-secondary hover:text-brand-text-primary'
              }`}
          >
            <Clock size={16} />
          </button>
          <button
            onClick={() => handleSortClick('voted')}
            className={`p-2 rounded-md transition-colors ${sortByTab[currentTab] === 'voted'
                ? 'bg-base-100 text-brand-primary shadow-sm [data-theme="dark"]:bg-base-200 [data-theme="dark"]:shadow-[0_1px_2px_0_rgba(255,255,255,0.1)]'
                : 'text-brand-text-secondary hover:text-brand-text-primary'
              }`}
          >
            <TrendingUp size={16} />
          </button>
          </div>
        </div>
      </div>

      {/* Search Modal Portal - only render when open */}
      {showSearchModal && (
        <BottomActionSheet
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          title="Search"
        >
          <div className="space-y-4">
            <BrandInput
              type="text"
              placeholder={tCommon('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              leftIcon={<Search size={18} />}
              rightIcon={searchQuery ? (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="text-brand-text-muted hover:text-brand-text-primary transition-colors"
                  aria-label="Clear search"
                >
                  <X size={18} />
                </button>
              ) : undefined}
              className="w-full"
            />
          </div>
        </BottomActionSheet>
      )}
    </div>
  );
};

// Community Top Bar
const CommunityTopBar: React.FC<{ communityId: string }> = ({ communityId }) => {
  const { data: community } = useCommunity(communityId);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('pages.communities');
  const [showTagDropdown, setShowTagDropdown] = React.useState(false);
  const [showSnack, setShowSnack] = React.useState(false);
  const [showSearchModal, setShowSearchModal] = React.useState(false);

  // Fake data generation state
  const fakeDataMode = isFakeDataMode();
  const [generatingUserPosts, setGeneratingUserPosts] = React.useState(false);
  const [generatingBeneficiaryPosts, setGeneratingBeneficiaryPosts] = React.useState(false);
  const [fakeDataMessage, setFakeDataMessage] = React.useState('');

  // Get sortBy from URL params
  const sortBy = searchParams?.get('sort') || 'recent';
  const selectedTag = searchParams?.get('tag');
  const searchQuery = searchParams?.get('q') || '';
  const [localSearchQuery, setLocalSearchQuery] = React.useState(searchQuery);

  // Handle sort change
  const handleSortChange = (sort: 'recent' | 'voted') => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('sort', sort);
    router.push(`?${params.toString()}`);
  };

  // Handle tag filter
  const handleTagClick = (tag: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (selectedTag === tag) {
      params.delete('tag');
    } else {
      params.set('tag', tag);
    }
    router.push(`?${params.toString()}`);
    setShowTagDropdown(false);
  };

  // Handle clear tag filter (show all)
  const handleShowAll = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('tag');
    router.push(`?${params.toString()}`);
    setShowTagDropdown(false);
  };

  // Handle search query change
  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value.trim()) {
      params.set('q', value.trim());
    } else {
      params.delete('q');
    }
    router.push(`?${params.toString()}`);
  };

  // Handle search clear
  const handleSearchClear = () => {
    setLocalSearchQuery('');
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('q');
    router.push(`?${params.toString()}`);
  };

  // Sync local search query with URL params
  React.useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Handle fake data generation
  const handleGenerateUserPosts = async () => {
    setGeneratingUserPosts(true);
    setFakeDataMessage('');

    try {
      const result = await publicationsApiV1.generateFakeData('user', communityId);
      setFakeDataMessage(`Created ${result.count} user post(s)`);
      setTimeout(() => setFakeDataMessage(''), 3000);
      router.refresh();
    } catch (error) {
      console.error('Generate user posts error:', error);
      setFakeDataMessage('Failed to generate user posts');
      setTimeout(() => setFakeDataMessage(''), 3000);
    } finally {
      setGeneratingUserPosts(false);
    }
  };

  const handleGenerateBeneficiaryPosts = async () => {
    setGeneratingBeneficiaryPosts(true);
    setFakeDataMessage('');

    try {
      const result = await publicationsApiV1.generateFakeData('beneficiary', communityId);
      setFakeDataMessage(`Created ${result.count} post(s) with beneficiary`);
      setTimeout(() => setFakeDataMessage(''), 3000);
      router.refresh();
    } catch (error) {
      console.error('Generate beneficiary posts error:', error);
      setFakeDataMessage('Failed to generate posts with beneficiary');
      setTimeout(() => setFakeDataMessage(''), 3000);
    } finally {
      setGeneratingBeneficiaryPosts(false);
    }
  };

  const isMobile = !useMediaQuery('(min-width: 768px)');

  // Show mobile snack bar with community title when arriving/switching
  React.useEffect(() => {
    if (!isMobile) return;
    setShowSnack(true);
    const timeout = setTimeout(() => setShowSnack(false), 2000);
    return () => clearTimeout(timeout);
  }, [communityId, isMobile]);

  if (!community) {
    return null;
  }

  const hashtags = community.hashtags || [];
  // Determine admin rights
  const isAdmin = Boolean(
    user?.globalRole === 'superadmin' ||
    community.isAdmin
  );

  const handleBack = () => {
    router.push('/meriter/communities');
  };

  return (
    <div className="flex-shrink-0">
      <div className="sticky top-0 z-30 bg-base-100 border-b border-base-content/10 w-full">
        {/* Main Header Row */}
        <div className="flex items-center gap-3 px-4 h-14">
          {/* Back Button */}
          <BrandButton
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="px-2 -ml-2"
          >
            <ArrowLeft size={20} className="text-base-content" />
          </BrandButton>

          {/* Community Name */}
          <h1 className="text-lg font-semibold text-base-content truncate flex-1">
            {community.name}
          </h1>

          {/* Search Button */}
          <BrandButton
            variant="ghost"
            size="sm"
            onClick={() => setShowSearchModal(true)}
            className="px-2"
          >
            <Search size={18} className="text-base-content/70" />
          </BrandButton>

          {/* Sort Toggle */}
          <div className="flex gap-0.5 bg-base-200/50 p-0.5 rounded-lg">
            <button
              onClick={() => handleSortChange('recent')}
              className={`p-1.5 rounded-md transition-colors ${sortBy === 'recent'
                  ? 'bg-base-100 text-base-content shadow-sm [data-theme="dark"]:bg-base-200 [data-theme="dark"]:shadow-[0_1px_2px_0_rgba(255,255,255,0.1)]'
                  : 'text-base-content/50 hover:text-base-content'
                }`}
            >
              <Clock size={16} />
            </button>
            <button
              onClick={() => handleSortChange('voted')}
              className={`p-1.5 rounded-md transition-colors ${sortBy === 'voted'
                  ? 'bg-base-100 text-base-content shadow-sm [data-theme="dark"]:bg-base-200 [data-theme="dark"]:shadow-[0_1px_2px_0_rgba(255,255,255,0.1)]'
                  : 'text-base-content/50 hover:text-base-content'
                }`}
            >
              <TrendingUp size={16} />
            </button>
          </div>

          {/* Admin Settings */}
          {isAdmin && (
            <BrandButton
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/meriter/communities/${communityId}/settings`)}
              className="px-2"
            >
              <svg className="w-5 h-5 text-base-content/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </BrandButton>
          )}
        </div>

        {/* Tag Filter Row - only if tags exist */}
        {hashtags.length > 0 && (
          <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto">
            <button
              onClick={handleShowAll}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                !selectedTag
                  ? 'bg-base-content text-base-100'
                  : 'bg-base-200/50 text-base-content/70 hover:bg-base-200'
              }`}
            >
              All
            </button>
            {hashtags.map((tag: string) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedTag === tag
                    ? 'bg-base-content text-base-100'
                    : 'bg-base-200/50 text-base-content/70 hover:bg-base-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Fake Data Buttons - dev only */}
        {fakeDataMode && (
          <div className="flex items-center gap-2 px-4 pb-2">
            <BrandButton
              variant="outline"
              size="sm"
              onClick={handleGenerateUserPosts}
              disabled={generatingUserPosts || generatingBeneficiaryPosts}
            >
              {generatingUserPosts ? <Loader2 className="animate-spin" size={16} /> : '+'}
            </BrandButton>
            <BrandButton
              variant="outline"
              size="sm"
              onClick={handleGenerateBeneficiaryPosts}
              disabled={generatingUserPosts || generatingBeneficiaryPosts}
            >
              {generatingBeneficiaryPosts ? <Loader2 className="animate-spin" size={16} /> : '++'}
            </BrandButton>
            {fakeDataMessage && (
              <span className={`text-xs ${fakeDataMessage.includes('Failed') ? 'text-error' : 'text-success'}`}>
                {fakeDataMessage}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Search Modal */}
      {showSearchModal && (
        <BottomActionSheet
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          title={t('searchPlaceholder')}
        >
          <BrandInput
            type="text"
            placeholder={t('searchPlaceholder')}
            value={localSearchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            leftIcon={<Search size={18} className="text-base-content/40" />}
            rightIcon={localSearchQuery ? (
              <button
                type="button"
                onClick={handleSearchClear}
                className="text-base-content/40 hover:text-base-content transition-colors"
              >
                <X size={18} />
              </button>
            ) : undefined}
            autoFocus
          />
        </BottomActionSheet>
      )}
    </div>
  );
};
