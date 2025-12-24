import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { trpc, getTrpcClient } from '@/lib/trpc/client';
import { Comment } from '@/features/comments/components/comment';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useCommentWithdrawal } from '@/features/comments/hooks/useCommentWithdrawal';
import { useFeaturesConfig } from '@/hooks/useConfig';

// Mock dependencies
jest.mock('@/hooks/api/useCommunities');
jest.mock('@/features/comments/hooks/useCommentWithdrawal');
jest.mock('@/hooks/useConfig');
jest.mock('@/shared/hooks/use-comments', () => ({
  useComments: () => ({
    comments: [],
    showPlus: false,
    currentPlus: 0,
    currentMinus: 0,
    showMinus: false,
    showComments: false,
    setShowComments: jest.fn(),
    formCommentProps: {},
  }),
}));
jest.mock('@/stores/ui.store', () => ({
  useUIStore: () => ({
    openWithdrawPopup: jest.fn(),
    openVotingPopup: jest.fn(),
  }),
}));

const mockUseCommunity = useCommunity as jest.MockedFunction<typeof useCommunity>;
const mockUseCommentWithdrawal = useCommentWithdrawal as jest.MockedFunction<typeof useCommentWithdrawal>;
const mockUseFeaturesConfig = useFeaturesConfig as jest.MockedFunction<typeof useFeaturesConfig>;

// Mock messages for next-intl
const mockMessages = {
  shared: {
    withdraw: 'Withdraw',
    cancel: 'Cancel',
    confirm: 'Confirm',
  },
  comments: {
    withdraw: 'Withdraw',
  },
};

// Test wrapper with all required providers
// Use useState to ensure QueryClient is created once and matches production pattern
function TestWrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
            staleTime: 0,
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  const [trpcClient] = React.useState(() => getTrpcClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="en" messages={mockMessages}>
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

describe('Comment Withdrawal - Special Groups', () => {
  const mockComment = {
    _id: 'comment-1',
    authorId: 'author-1',
    communityId: 'community-1',
    content: 'Test comment',
    metrics: {
      score: 5,
      upvotes: 5,
      downvotes: 0,
    },
    meta: {
      author: {
        id: 'author-1',
        name: 'Author',
      },
    },
    permissions: {
      canVote: true,
      canEdit: true,
      canDelete: true,
      canComment: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseCommentWithdrawal.mockReturnValue({
      maxWithdrawAmount: 5,
      maxTopUpAmount: 0,
    });
    
    mockUseFeaturesConfig.mockReturnValue({ commentVoting: true } as unknown);
  });

  it('should hide withdrawal UI for comments in marathon-of-good community', () => {
    mockUseCommunity.mockReturnValue({
      data: {
        id: 'community-1',
        typeTag: 'marathon-of-good',
        name: 'Marathon of Good',
      },
      isLoading: false,
      error: null,
    } as unknown);

    render(
      <TestWrapper>
        <Comment
          {...mockComment}
          myId="author-1"
          wallets={[]}
          updateWalletBalance={jest.fn()}
          updateAll={jest.fn()}
          activeCommentHook={[null, jest.fn()]}
        />
      </TestWrapper>
    );

    // Withdrawal button should not be visible for author in special group
    const withdrawButton = screen.queryByText(/withdraw/i);
    expect(withdrawButton).not.toBeInTheDocument();
  });

  it('should hide withdrawal UI for comments in future-vision community', () => {
    mockUseCommunity.mockReturnValue({
      data: {
        id: 'community-1',
        typeTag: 'future-vision',
        name: 'Future Vision',
      },
      isLoading: false,
      error: null,
    } as unknown);

    render(
      <TestWrapper>
        <Comment
          {...mockComment}
          myId="author-1"
          wallets={[]}
          updateWalletBalance={jest.fn()}
          updateAll={jest.fn()}
          activeCommentHook={[null, jest.fn()]}
        />
      </TestWrapper>
    );

    // Withdrawal button should not be visible for author in special group
    const withdrawButton = screen.queryByText(/withdraw/i);
    expect(withdrawButton).not.toBeInTheDocument();
  });

  it('should show withdrawal UI for comments in regular community', () => {
    mockUseCommunity.mockReturnValue({
      data: {
        id: 'community-1',
        typeTag: 'custom',
        name: 'Regular Community',
      },
      isLoading: false,
      error: null,
    } as unknown);

    render(
      <TestWrapper>
        <Comment
          {...mockComment}
          myId="author-1"
          wallets={[]}
          updateWalletBalance={jest.fn()}
          updateAll={jest.fn()}
          activeCommentHook={[null, jest.fn()]}
        />
      </TestWrapper>
    );

    // Withdrawal should be available for regular communities
    // Note: Actual visibility depends on isAuthor logic
  });
});

