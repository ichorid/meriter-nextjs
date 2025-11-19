'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCommunity, useWallets } from '@/hooks/api';
import { useUserQuota } from '@/hooks/api/useQuota';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { isFakeDataMode } from '@/config';
import { publicationsApiV1 } from '@/lib/api/v1';
// Gluestack UI components
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { Select, SelectTrigger, SelectInput, SelectIcon, SelectPortal, SelectBackdrop, SelectContent, SelectDragIndicatorWrapper, SelectDragIndicator, SelectItem } from '@/components/ui/select';
import { ChevronDownIcon } from '@gluestack-ui/themed';
import { useHomeTabState } from '@/app/meriter/home/hooks';
import type { TabSortState } from '@/app/meriter/home/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Pressable } from 'react-native';
import { Spinner } from '@/components/ui/spinner';

export interface ContextTopBarProps {
  className?: string;
}

export const ContextTopBar: React.FC<ContextTopBarProps> = () => {
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
    return <PostDetailTopBar pathname={pathname} />;
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
    return <SettingsTopBar />;
  }

  // Default top bar - empty, no header
  return null;
};

// Home Top Bar with Tabs
const HomeTopBar: React.FC = () => {
  const pathname = usePathname();
  const t = useTranslations('home');
  const isMobile = !useMediaQuery('(min-width: 768px)');
  
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

  return (
    <Box 
      position="sticky" 
      top={0} 
      zIndex={30} 
      height={64} 
      bg="$white" 
      borderBottomWidth={1} 
      borderColor="$borderLight300"
      px="$4"
      py="$2"
    >
      <HStack space="md" alignItems="center" justifyContent="space-between" height="100%">
        {/* Tabs: buttons on md+, dropdown on mobile */}
        {!isMobile ? (
          <HStack space="sm" flex={1} justifyContent="center">
            <Button
              variant={currentTab === 'publications' ? 'solid' : 'outline'}
              size="sm"
              onPress={() => handleTabClick('publications')}
            >
              <ButtonText>{t('tabs.publications') || 'My Publications'}</ButtonText>
            </Button>
            <Button
              variant={currentTab === 'comments' ? 'solid' : 'outline'}
              size="sm"
              onPress={() => handleTabClick('comments')}
            >
              <ButtonText>{t('tabs.comments') || 'My Comments'}</ButtonText>
            </Button>
            <Button
              variant={currentTab === 'polls' ? 'solid' : 'outline'}
              size="sm"
              onPress={() => handleTabClick('polls')}
            >
              <ButtonText>{t('tabs.polls') || 'Polls'}</ButtonText>
            </Button>
            <Button
              variant={currentTab === 'updates' ? 'solid' : 'outline'}
              size="sm"
              onPress={() => handleTabClick('updates')}
            >
              <ButtonText>{t('tabs.updates') || 'Updates'}</ButtonText>
            </Button>
          </HStack>
        ) : (
          <Box flex={1}>
          <Select
            selectedValue={currentTab}
            onValueChange={(value) => handleTabClick(value as any)}
          >
            <SelectTrigger variant="outline" size="sm" minWidth={150}>
              <SelectInput placeholder="Select tab" />
              <SelectIcon mr="$3">
                <ChevronDownIcon />
              </SelectIcon>
            </SelectTrigger>
            <SelectPortal>
              <SelectBackdrop />
              <SelectContent>
                <SelectDragIndicatorWrapper>
                  <SelectDragIndicator />
                </SelectDragIndicatorWrapper>
                <SelectItem label={t('tabs.publications') || 'My Publications'} value="publications" />
                <SelectItem label={t('tabs.comments') || 'My Comments'} value="comments" />
                <SelectItem label={t('tabs.polls') || 'Polls'} value="polls" />
                <SelectItem label={t('tabs.updates') || 'Updates'} value="updates" />
              </SelectContent>
            </SelectPortal>
          </Select>
          </Box>
        )}
        
        {/* Sort Toggle - contextual to active tab */}
        <HStack space="xs">
          <Button
            variant={sortByTab[currentTab] === 'recent' ? 'solid' : 'outline'}
            size="sm"
            onPress={() => handleSortClick('recent')}
          >
            <ButtonText>{t('sort.recent') || 'By Date'}</ButtonText>
          </Button>
          <Button
            variant={sortByTab[currentTab] === 'voted' ? 'solid' : 'outline'}
            size="sm"
            onPress={() => handleSortClick('voted')}
          >
            <ButtonText>{t('sort.voted') || 'By Rating'}</ButtonText>
          </Button>
        </HStack>
      </HStack>
    </Box>
  );
};

// Community Top Bar
const CommunityTopBar: React.FC<{ communityId: string }> = ({ communityId }) => {
  const { data: community } = useCommunity(communityId);
  const { user } = useAuth();
  const { data: wallets = [] } = useWallets();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('pages.communities');
  const [showTagDropdown, setShowTagDropdown] = React.useState(false);
  const [showSnack, setShowSnack] = React.useState(false);
  
  // Fake data generation state
  const fakeDataMode = isFakeDataMode();
  const [generatingUserPosts, setGeneratingUserPosts] = React.useState(false);
  const [generatingBeneficiaryPosts, setGeneratingBeneficiaryPosts] = React.useState(false);
  const [fakeDataMessage, setFakeDataMessage] = React.useState('');

  // Get wallet balance for this community
  const wallet = wallets.find((w: any) => w.communityId === communityId);
  const balance = wallet?.balance || 0;

  // Get free vote quota using standardized hook
  const { data: quota, error: quotaError } = useUserQuota(community?.id);


  // Get sortBy from URL params
  const sortBy = searchParams?.get('sort') || 'recent';
  const selectedTag = searchParams?.get('tag');

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

  // Handle create poll - set modal state via URL param
  const handleCreatePoll = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('modal', 'createPoll');
    router.push(`?${params.toString()}`);
  };

  // Handle fake data generation
  const handleGenerateUserPosts = async () => {
    setGeneratingUserPosts(true);
    setFakeDataMessage('');
    
    try {
      const result = await publicationsApiV1.generateFakeData('user', communityId);
      setFakeDataMessage(`Created ${result.count} user post(s)`);
      setTimeout(() => setFakeDataMessage(''), 3000);
      // Refresh the page to show new posts
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
      // Refresh the page to show new posts
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
  // Determine admin rights: prefer backend-computed flag, fallback to telegram-based list
  const isAdmin = Boolean(
    community.isAdmin ?? (
      Array.isArray((community as any).adminsTG) && user?.telegramId
        ? (community as any).adminsTG.includes(user.telegramId)
        : false
    )
  );

  return (
    <Box 
      position="sticky" 
      top={0} 
      zIndex={30} 
      height={64} 
      bg="$white" 
      borderBottomWidth={1} 
      borderColor="$borderLight300"
      px="$4"
      py="$2"
    >
      <HStack space="md" alignItems="center" justifyContent="flex-end" height="100%">
        {/* Fake Data Generation Buttons - Only shown in fake mode */}
        {fakeDataMode && (
          <HStack space="sm" alignItems="center">
            <Button
              variant="outline"
              size="sm"
              onPress={handleGenerateUserPosts}
              isDisabled={generatingUserPosts || generatingBeneficiaryPosts}
            >
              {generatingUserPosts ? (
                <HStack space="sm" alignItems="center">
                  <Spinner size="small" />
                </HStack>
              ) : (
                <ButtonText>+</ButtonText>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={handleGenerateBeneficiaryPosts}
              isDisabled={generatingUserPosts || generatingBeneficiaryPosts}
            >
              {generatingBeneficiaryPosts ? (
                <HStack space="sm" alignItems="center">
                  <Spinner size="small" />
                </HStack>
              ) : (
                <ButtonText>++</ButtonText>
              )}
            </Button>
            {fakeDataMessage && (
              <Text 
                size="xs" 
                color={fakeDataMessage.includes('Failed') ? '$error500' : '$success500'}
              >
                {fakeDataMessage}
              </Text>
            )}
          </HStack>
        )}
        
        {/* Tag Filter Dropdown */}
        {hashtags.length > 0 && (
          <Box position="relative">
            <Button
              variant="outline"
              size="sm"
              onPress={() => setShowTagDropdown(!showTagDropdown)}
            >
              <ButtonText>{selectedTag ? `#${selectedTag}` : t('filterByTags')}</ButtonText>
            </Button>
            
            {showTagDropdown && (
              <>
                <Pressable 
                  style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                  onPress={() => setShowTagDropdown(false)}
                />
                <Box 
                  position="absolute" 
                  right={0} 
                  top="100%" 
                  mt="$2" 
                  width={256} 
                  maxHeight={384} 
                  bg="$white" 
                  borderRadius="$lg" 
                  borderWidth={1} 
                  borderColor="$borderLight300"
                  p="$3"
                  zIndex={20}
                >
                  <HStack space="sm" flexWrap="wrap">
                    <Button
                      variant={!selectedTag ? 'solid' : 'outline'}
                      size="xs"
                      onPress={handleShowAll}
                    >
                      <ButtonText>{t('showAll')}</ButtonText>
                    </Button>
                    {hashtags.map((tag: string) => (
                      <Button
                        key={tag}
                        variant={selectedTag === tag ? 'solid' : 'outline'}
                        size="xs"
                        onPress={() => handleTagClick(tag)}
                      >
                        <ButtonText>#{tag}</ButtonText>
                      </Button>
                    ))}
                  </HStack>
                </Box>
              </>
            )}
          </Box>
        )}

        {/* Sort Toggle */}
        <HStack space="xs">
          <Button
            variant={sortBy === 'recent' ? 'solid' : 'outline'}
            size="sm"
            onPress={() => handleSortChange('recent')}
          >
            <ButtonText>{t('byDate')}</ButtonText>
          </Button>
          <Button
            variant={sortBy === 'voted' ? 'solid' : 'outline'}
            size="sm"
            onPress={() => handleSortChange('voted')}
          >
            <ButtonText>{t('byRating')}</ButtonText>
          </Button>
        </HStack>
      </HStack>
      
      {/* Mobile snackbar with community title on navigation */}
      {showSnack && isMobile && (
        <Box 
          position="fixed" 
          bottom={16} 
          left={0} 
          right={0} 
          zIndex={50}
          alignItems="center"
        >
          <Box 
            px="$3" 
            py="$2" 
            borderRadius="$full" 
            bg="$gray100" 
            borderWidth={1} 
            borderColor="$borderLight300"
            maxWidth="80%"
          >
            <Text size="sm">{community.name}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

// Settings Top Bar - empty, no header
const SettingsTopBar: React.FC = () => {
  return null;
};

// Post Detail Top Bar with Back Button - empty, no header
const PostDetailTopBar: React.FC<{ pathname: string | null }> = () => {
  return null;
};

