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
import { BrandSelect } from '@/components/ui/BrandSelect';
import { BrandInput } from '@/components/ui/BrandInput';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { Clock, TrendingUp, Loader2, Search, X } from 'lucide-react';
import { useHomeTabState } from '@/app/meriter/home/hooks';
import type { TabSortState } from '@/app/meriter/home/types';
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
  const isHomePage = pathname === '/meriter/home';
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

  if (isHomePage) {
    return <HomeTopBar />;
  }

  if (isSettingsPage) {
    return null; // SettingsTopBar was empty
  }

  // Default top bar - empty, no header
  return null;
};

// Home Top Bar with Tabs
const HomeTopBar: React.FC = () => {
  const t = useTranslations('home');
  const router = useRouter();
  const isMobile = !useMediaQuery('(min-width: 768px)');
  const [showSearchModal, setShowSearchModal] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Use the same hook as the page to sync state
  const { currentTab, setCurrentTab, sortByTab, setSortByTab } = useHomeTabState();

  const handleTabClick = (tab: 'publications' | 'comments' | 'polls' | 'updates') => {
    setCurrentTab(tab);
    let hashPart = '';
    if (tab === 'comments') {
      hashPart = '#comments';
    } else if (tab === 'polls') {
      hashPart = '#polls';
    } else if (tab === 'updates') {
      hashPart = '#updates-frequency';
    }
    // For publications, hashPart stays empty (default)

    // Use the stored sort preference for this tab
    const urlParams = new URLSearchParams();
    urlParams.set('sort', sortByTab[tab]);

    // Set hash: for publications, use empty hash with sort params, for others use hashPart with sort
    if (tab === 'publications') {
      window.location.hash = urlParams.toString() ? `?${urlParams.toString()}` : '';
    } else {
      window.location.hash = `${hashPart}?${urlParams.toString()}`;
    }
  };

  const handleSortClick = (sort: 'recent' | 'voted') => {
    // Update sort for the current active tab
    setSortByTab((prev: TabSortState) => ({
      ...prev,
      [currentTab]: sort,
    }));

    const urlParams = new URLSearchParams();
    urlParams.set('sort', sort);

    let hashPart = '';
    if (currentTab === 'comments') {
      hashPart = '#comments';
    } else if (currentTab === 'polls') {
      hashPart = '#polls';
    } else if (currentTab === 'updates') {
      hashPart = '#updates-frequency';
    }
    // For publications tab, hashPart stays empty (default hash)

    // Set hash: for publications, use empty hash with sort params, for others use hashPart with sort
    if (currentTab === 'publications') {
      window.location.hash = urlParams.toString() ? `?${urlParams.toString()}` : '';
    } else {
      window.location.hash = `${hashPart}?${urlParams.toString()}`;
    }
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
    <div>
      <div className="sticky top-0 z-30 h-16 bg-base-100 border-b border-brand-border px-4 py-2">
        <div className="flex items-center justify-between h-full gap-4">
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

          {/* Tabs: buttons on md+, dropdown on mobile */}
          {!isMobile ? (
            <div className="flex flex-1 justify-center gap-2">
              <BrandButton
                variant={currentTab === 'publications' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleTabClick('publications')}
                className={currentTab !== 'publications' ? 'dark:text-base-content' : ''}
              >
                {t('tabs.publications') || 'My Publications'}
              </BrandButton>
              <BrandButton
                variant={currentTab === 'comments' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleTabClick('comments')}
                className={currentTab !== 'comments' ? 'dark:text-base-content' : ''}
              >
                {t('tabs.comments') || 'My Comments'}
              </BrandButton>
              <BrandButton
                variant={currentTab === 'polls' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleTabClick('polls')}
                className={currentTab !== 'polls' ? 'dark:text-base-content' : ''}
              >
                {t('tabs.polls') || 'Polls'}
              </BrandButton>
              <BrandButton
                variant={currentTab === 'updates' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleTabClick('updates')}
                className={currentTab !== 'updates' ? 'dark:text-base-content' : ''}
              >
                {t('tabs.updates') || 'Updates'}
              </BrandButton>
            </div>
          ) : (
            <div className="flex-1">
              <BrandSelect
                value={currentTab}
                onChange={(value) => handleTabClick(value as any)}
                options={[
                  { label: t('tabs.publications') || 'My Publications', value: 'publications' },
                  { label: t('tabs.comments') || 'My Comments', value: 'comments' },
                  { label: t('tabs.polls') || 'Polls', value: 'polls' },
                  { label: t('tabs.updates') || 'Updates', value: 'updates' },
                ]}
                placeholder="Select tab"
                fullWidth
              />
            </div>
          )}

          {/* Sort Toggle - contextual to active tab */}
          <div className="flex gap-1 bg-brand-surface p-1 rounded-md border border-brand-border">
          <button
            onClick={() => handleSortClick('recent')}
            className={`p-2 rounded-md transition-colors ${sortByTab[currentTab] === 'recent'
                ? 'bg-base-100 shadow-sm text-brand-primary'
                : 'text-brand-text-secondary hover:text-brand-text-primary dark:text-base-content dark:hover:text-base-content'
              }`}
          >
            <Clock size={16} />
          </button>
          <button
            onClick={() => handleSortClick('voted')}
            className={`p-2 rounded-md transition-colors ${sortByTab[currentTab] === 'voted'
                ? 'bg-base-100 shadow-sm text-brand-primary'
                : 'text-brand-text-secondary hover:text-brand-text-primary dark:text-base-content dark:hover:text-base-content'
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
              placeholder="Search..."
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
    community.isAdmin ?? (
      Array.isArray((community as any).adminIds) && user?.id
        ? (community as any).adminIds.includes(user.id)
        : false
    )
  );

  return (
    <div>
      <div className="sticky top-0 z-50 bg-base-100 border-b border-brand-border shadow-sm">
        <div className="flex items-center justify-between gap-4 px-4 py-3 min-h-[56px]">
          {/* Search Button */}
          <BrandButton
            variant="ghost"
            size="sm"
            onClick={() => setShowSearchModal(true)}
            aria-label={t('searchPlaceholder') || 'Search'}
          >
            <Search size={18} />
          </BrandButton>

          {/* Filters and Actions Row */}
          <div className="flex items-center gap-4">
            {/* Fake Data Generation Buttons */}
            {fakeDataMode && (
              <div className="flex items-center gap-2">
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
                  <span className={`text-xs ${fakeDataMessage.includes('Failed') ? 'text-red-500' : 'text-green-500'}`}>
                    {fakeDataMessage}
                  </span>
                )}
              </div>
            )}

            {/* Tag Filter Dropdown */}
            {hashtags.length > 0 && (
              <div className="relative">
                <BrandButton
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTagDropdown(!showTagDropdown)}
                >
                  {selectedTag ? `#${selectedTag}` : t('filterByTags')}
                </BrandButton>

                {showTagDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowTagDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-64 max-h-96 bg-base-100 rounded-lg border border-brand-border p-3 z-20 shadow-lg overflow-y-auto">
                      <div className="flex flex-wrap gap-2">
                        <BrandButton
                          variant={!selectedTag ? 'primary' : 'outline'}
                          size="sm"
                          onClick={handleShowAll}
                          className="text-xs"
                        >
                          {t('showAll')}
                        </BrandButton>
                        {hashtags.map((tag: string) => (
                          <BrandButton
                            key={tag}
                            variant={selectedTag === tag ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => handleTagClick(tag)}
                            className="text-xs"
                          >
                            #{tag}
                          </BrandButton>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Admin Settings Button */}
            {isAdmin && (
              <BrandButton
                variant="outline"
                size="sm"
                onClick={() => router.push(`/meriter/communities/${communityId}/settings`)}
              >
                Settings
              </BrandButton>
            )}

            {/* Sort Toggle - Icon Tabs */}
            <div className="flex gap-1 bg-brand-surface p-1 rounded-md border border-brand-border">
              <button
                onClick={() => handleSortChange('recent')}
                className={`p-2 rounded-md transition-colors ${sortBy === 'recent'
                    ? 'bg-base-100 shadow-sm text-brand-primary'
                    : 'text-brand-text-secondary hover:text-brand-text-primary dark:text-base-content dark:hover:text-base-content'
                  }`}
              >
                <Clock size={16} />
              </button>
              <button
                onClick={() => handleSortChange('voted')}
                className={`p-2 rounded-md transition-colors ${sortBy === 'voted'
                    ? 'bg-base-100 shadow-sm text-brand-primary'
                    : 'text-brand-text-secondary hover:text-brand-text-primary dark:text-base-content dark:hover:text-base-content'
                  }`}
              >
                <TrendingUp size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile snackbar with community title */}
      {showSnack && isMobile && (
        <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="px-3 py-2 rounded-full bg-base-200 border border-brand-border dark:border-base-300/50 max-w-[80%] shadow-md">
            <span className="text-sm font-medium text-brand-text-primary dark:text-base-content">{community.name}</span>
          </div>
        </div>
      )}

      {/* Search Modal Portal - only render when open */}
      {showSearchModal && (
        <BottomActionSheet
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          title={t('searchPlaceholder') || 'Search publications...'}
        >
          <div className="space-y-4">
            <BrandInput
              type="text"
              placeholder={t('searchPlaceholder') || 'Search publications...'}
              value={localSearchQuery}
              onChange={(e) => {
                handleSearchChange(e.target.value);
              }}
              leftIcon={<Search size={18} />}
              rightIcon={localSearchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    handleSearchClear();
                  }}
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
