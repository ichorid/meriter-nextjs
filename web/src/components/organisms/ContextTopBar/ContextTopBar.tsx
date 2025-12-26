'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCommunity, useWallets } from '@/hooks/api';
import { useUserQuota } from '@/hooks/api/useQuota';
import { useTranslations } from 'next-intl';
import { isFakeDataMode } from '@/config';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { cn } from '@/lib/utils';
import { Clock, TrendingUp, Loader2, Search, X, ArrowLeft, Settings, Info } from 'lucide-react';
import { useProfileTabState } from '@/hooks/useProfileTabState';
import type { TabSortState } from '@/hooks/useProfileTabState';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { SortToggle } from '@/components/ui/SortToggle';

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
    // Community pages use stickyHeader in AdaptiveLayout instead
    return null;
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
export const ProfileTopBar: React.FC<{ asStickyHeader?: boolean }> = ({ asStickyHeader = false }) => {
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

  const rightAction = (
    <div className="flex items-center gap-2 flex-shrink-0">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowSearchModal(true)}
        aria-label={tCommon('search')}
        className="rounded-xl active:scale-[0.98] px-2"
      >
        <Search size={18} className="text-base-content/70" />
      </Button>

      <SortToggle
        value={sortByTab[currentTab]}
        onChange={handleSortClick}
        compact={true}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/meriter/settings')}
        aria-label={tCommon('settings')}
        className="rounded-xl active:scale-[0.98] px-2"
      >
        <Settings size={20} className="text-base-content/70" />
      </Button>
    </div>
  );

  return (
    <>
      <SimpleStickyHeader
        title={tCommon('profile')}
        showBack={true}
        onBack={() => router.push('/meriter/profile')}
        rightAction={rightAction}
        asStickyHeader={asStickyHeader}
      />

      {/* Search Modal Portal - only render when open */}
      {showSearchModal && (
        <BottomActionSheet
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          title={tCommon('search')}
        >
          <div className="space-y-4">
            <div className="relative w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
              <Input
                type="text"
                placeholder={tCommon('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className={cn('h-11 rounded-xl pl-10', searchQuery && 'pr-10')}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                  aria-label={tCommon('clearSearch')}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        </BottomActionSheet>
      )}
    </>
  );
};

// Simple Sticky Header for generic pages
export const SimpleStickyHeader: React.FC<{
  title: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  className?: string;
  asStickyHeader?: boolean;
}> = ({
  title,
  onBack,
  showBack = true,
  rightAction,
  className = '',
  asStickyHeader = false
}) => {
    const router = useRouter();
    const tCommon = useTranslations('common');

    const handleBack = () => {
      if (onBack) {
        onBack();
      } else {
        router.back();
      }
    };

    const headerContent = (
      <div className={`${asStickyHeader ? "bg-base-100/95 backdrop-blur-md border-b border-base-content/10" : "sticky top-0 z-30 bg-base-100/95 backdrop-blur-md border-b border-base-content/10 w-full"} ${className}`}>
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center flex-1 min-w-0">
            {/* Back Button */}
            {showBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                aria-label={tCommon('goBack')}
                className="rounded-xl active:scale-[0.98] px-2"
              >
                <ArrowLeft size={20} className="text-base-content" />
              </Button>
            )}

            {/* Title */}
            <h1 className="text-lg font-semibold text-base-content truncate px-2">
              {title}
            </h1>
          </div>

          {/* Right Actions */}
          {rightAction && (
            <div className="flex items-center flex-shrink-0">
              {rightAction}
            </div>
          )}
        </div>
      </div>
    );

    return (
      <>
        {asStickyHeader ? headerContent : (
          <div className="flex-shrink-0">
            {headerContent}
          </div>
        )}
      </>
    );
  };

// Community Top Bar
export const CommunityTopBar: React.FC<{ communityId: string; asStickyHeader?: boolean }> = ({ communityId, asStickyHeader = false }) => {
  const { data: community, isLoading: communityLoading } = useCommunity(communityId);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('pages.communities');
  const tCommon = useTranslations('common');
  const [showTagDropdown, setShowTagDropdown] = React.useState(false);
  const [showSnack, setShowSnack] = React.useState(false);
  const [showSearchModal, setShowSearchModal] = React.useState(false);

  // Fake data generation state
  const fakeDataMode = isFakeDataMode();
  const [generatingUserPosts, setGeneratingUserPosts] = React.useState(false);
  const [generatingBeneficiaryPosts, setGeneratingBeneficiaryPosts] = React.useState(false);
  const [fakeDataMessage, setFakeDataMessage] = React.useState('');

  // Get sortBy from URL params
  const sortBy = searchParams?.get('sort') === 'recent' ? 'recent' : 'voted';
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
  const generateFakeDataMutation = trpc.publications.generateFakeData.useMutation();

  const handleGenerateUserPosts = async () => {
    setGeneratingUserPosts(true);
    setFakeDataMessage('');

    try {
      const result = await generateFakeDataMutation.mutateAsync({
        type: 'user',
        communityId,
      });
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
      const result = await generateFakeDataMutation.mutateAsync({
        type: 'beneficiary',
        communityId,
      });
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
  // Left nav is hidden below lg breakpoint (1024px), so show back button when nav is hidden
  const isLeftNavHidden = !useMediaQuery('(min-width: 1024px)');

  // Show mobile snack bar with community title when arriving/switching
  React.useEffect(() => {
    if (!isMobile) return;
    setShowSnack(true);
    const timeout = setTimeout(() => setShowSnack(false), 2000);
    return () => clearTimeout(timeout);
  }, [communityId, isMobile]);

  // Show loading state instead of returning null
  if (communityLoading) {
    const handleBack = () => {
      router.push('/meriter/communities');
    };
    
    return (
      <SimpleStickyHeader
        title=""
        showBack={isLeftNavHidden}
        onBack={handleBack}
        asStickyHeader={asStickyHeader}
        rightAction={
          <Loader2 className="w-4 h-4 animate-spin text-base-content/70" />
        }
      />
    );
  }

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

  const headerContent = (
    <SimpleStickyHeader
      title={community.name}
      showBack={isLeftNavHidden}
      onBack={handleBack}
      asStickyHeader={asStickyHeader}
      rightAction={
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearchModal(true)}
            className="rounded-xl active:scale-[0.98] px-2"
          >
            <Search size={18} className="text-base-content/70" />
          </Button>

          {/* Sort Toggle */}
          <div className="flex gap-0.5 bg-base-200/50 p-0.5 rounded-lg">
            <SortToggle
              value={sortBy}
              onChange={handleSortChange}
              compact={true}
            />
          </div>

          {/* Fake Data Buttons - dev only */}
          {fakeDataMode && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateUserPosts}
                disabled={generatingUserPosts || generatingBeneficiaryPosts}
                className="rounded-xl active:scale-[0.98] px-2"
                title="Generate user post"
              >
                {generatingUserPosts ? <Loader2 className="animate-spin" size={16} /> : <span>+</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateBeneficiaryPosts}
                disabled={generatingUserPosts || generatingBeneficiaryPosts}
                className="rounded-xl active:scale-[0.98] px-2"
                title="Generate post with beneficiary"
              >
                {generatingBeneficiaryPosts ? <Loader2 className="animate-spin" size={16} /> : <span>++</span>}
              </Button>
              {fakeDataMessage && (
                <span className={`text-xs ${fakeDataMessage.includes('Failed') ? 'text-error' : 'text-success'}`}>
                  {fakeDataMessage}
                </span>
              )}
            </>
          )}

          {/* Info Button - Community Rules */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/meriter/communities/${communityId}/rules`)}
            aria-label={tCommon('info') || 'Community info'}
            className="rounded-xl active:scale-[0.98] px-2"
          >
            <Info size={18} className="text-base-content/70" />
          </Button>

          {/* General Settings Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/meriter/settings')}
            aria-label={tCommon('settings')}
            className="rounded-xl active:scale-[0.98] px-2"
          >
            <Settings size={20} className="text-base-content/70" />
          </Button>

          {/* Admin Settings */}
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/meriter/communities/${communityId}/settings`)}
              className="rounded-xl active:scale-[0.98] px-2"
              aria-label="Community admin settings"
            >
              <svg className="w-5 h-5 text-base-content/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Button>
          )}
        </div>
      }
    />
  );

  return (
    <>
      {asStickyHeader ? headerContent : (
        <div className="flex-shrink-0">
          {headerContent}
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <BottomActionSheet
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          title={t('searchPlaceholder')}
        >
          <div className="relative w-full">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={localSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={cn('h-11 rounded-xl pl-10', localSearchQuery && 'pr-10')}
              autoFocus
            />
            {localSearchQuery && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </BottomActionSheet>
      )}
    </>
  );
};
