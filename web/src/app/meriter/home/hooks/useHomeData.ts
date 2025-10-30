import { useMyPublications, useWallets, usePolls, useUpdates } from '@/hooks/api';
import { useMyComments } from '@/hooks/api/useComments';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeArray, normalizePaginatedData } from '../utils';

/**
 * Hook to fetch all home page data
 */
export function useHomeData() {
  const { user } = useAuth();

  // Fetch publications
  const {
    data: myPublicationsData,
    isLoading: publicationsLoading,
  } = useMyPublications({
    skip: 0,
    limit: 100,
    userId: user?.id || undefined,
  });

  // Fetch wallets
  const { data: wallets = [], isLoading: walletsLoading } = useWallets();

  // Fetch polls
  const { data: pollsData, isLoading: pollsLoading } = usePolls({
    skip: 0,
    limit: 100,
    userId: user?.id || undefined,
  });

  // Fetch transaction updates
  const {
    data: updatesData,
    isLoading: updatesLoading,
  } = useUpdates(user?.id || 'me', { skip: 0, limit: 100 });

  // Fetch user comments
  const {
    data: commentsData,
    isLoading: commentsLoading,
  } = useMyComments(user?.id || '', { skip: 0, limit: 100 });

  // Normalize data
  const myPublications = normalizeArray(myPublicationsData);

  const myComments = normalizePaginatedData(commentsData?.data);

  const myPolls = normalizePaginatedData(pollsData?.data);

  const updatesArray = normalizePaginatedData(updatesData);

  return {
    // Publications
    myPublications,
    publicationsLoading,

    // Comments
    myComments,
    commentsLoading,

    // Polls
    myPolls,
    pollsLoading,

    // Updates
    updatesArray,
    updatesLoading,

    // Wallets
    wallets: normalizeArray(wallets),
    walletsLoading,
  };
}

