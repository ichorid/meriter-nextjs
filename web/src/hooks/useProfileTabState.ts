import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export type ProfileTab = 'publications' | 'comments' | 'polls' | 'projects';
export type SortOrder = 'recent' | 'voted';

export interface TabSortState {
  publications: SortOrder;
  comments: SortOrder;
  polls: SortOrder;
  projects: SortOrder;
}

/**
 * Hook to manage tab and sort state from URL pathname and search params
 * (adapted from useHomeTabState for profile routes)
 */
export function useProfileTabState() {
  const pathname = usePathname();
  const [currentTab, setCurrentTab] = useState<ProfileTab>('publications');
  const [sortByTab, setSortByTab] = useState<TabSortState>({
    publications: 'recent',
    comments: 'recent',
    polls: 'recent',
    projects: 'recent',
  });

  useEffect(() => {
    // Determine tab from pathname
    if (pathname?.includes('/profile/comments')) {
      setCurrentTab('comments');
    } else if (pathname?.includes('/profile/polls')) {
      setCurrentTab('polls');
    } else if (pathname?.includes('/profile/projects')) {
      setCurrentTab('projects');
    } else if (pathname?.includes('/profile/publications')) {
      setCurrentTab('publications');
    } else {
      setCurrentTab('publications');
    }

    // Parse sort from URL search params
    const searchParams = new URLSearchParams(window.location.search);
    const sortParam = searchParams.get('sort');
    const sortValue: SortOrder = sortParam === 'voted' ? 'voted' : 'recent';

    // Update sort for the current tab
    setSortByTab((prev) => ({
      ...prev,
      [currentTab]: sortValue,
    }));
  }, [pathname, currentTab]);

  const updateSort = (tab: ProfileTab, sort: SortOrder) => {
    setSortByTab((prev) => ({
      ...prev,
      [tab]: sort,
    }));
  };

  return { currentTab, setCurrentTab, sortByTab, setSortByTab, updateSort };
}

