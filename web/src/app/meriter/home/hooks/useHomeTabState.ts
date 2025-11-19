import { useEffect, useState } from 'react';
import type { HomeTab, TabSortState, SortOrder } from '../types';

/**
 * Hook to manage tab and sort state from URL hash
 */
export function useHomeTabState() {
  const [currentTab, setCurrentTab] = useState<HomeTab>('publications');
  const [sortByTab, setSortByTab] = useState<TabSortState>({
    publications: 'recent',
    comments: 'recent',
    polls: 'recent',
    updates: 'recent',
  });

  useEffect(() => {
    const updateFromHash = () => {
      const hash = window.location.hash;
      const search = window.location.search;

      // Parse tab from hash
      let detectedTab: HomeTab = 'publications';
      if (hash.includes('comments')) {
        detectedTab = 'comments';
      } else if (hash.includes('polls')) {
        detectedTab = 'polls';
      } else if (hash.includes('updates-frequency')) {
        detectedTab = 'updates';
      } else {
        detectedTab = 'publications';
      }
      setCurrentTab(detectedTab);

      // Parse sort from hash or search params
      const hashParams = hash.replace(/^#/, '').split('?')[1] || '';
      const urlParams = new URLSearchParams(hashParams || search);
      const sortParam = urlParams.get('sort');
      const sortValue: SortOrder = sortParam === 'voted' ? 'voted' : 'recent';

      // Update sort for the detected tab
      setSortByTab((prev) => ({
        ...prev,
        [detectedTab]: sortValue,
      }));
    };

    // Initial load
    updateFromHash();

    // Listen for hash changes
    window.addEventListener('hashchange', updateFromHash);
    window.addEventListener('popstate', updateFromHash);

    return () => {
      window.removeEventListener('hashchange', updateFromHash);
      window.removeEventListener('popstate', updateFromHash);
    };
  }, []);

  const updateSort = (tab: HomeTab, sort: SortOrder) => {
    setSortByTab((prev) => ({
      ...prev,
      [tab]: sort,
    }));
  };

  return { currentTab, setCurrentTab, sortByTab, setSortByTab, updateSort };
}

