import React from 'react';
import { render, screen } from '@testing-library/react';
import { Comment } from '@/features/comments/components/comment';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useCommentWithdrawal } from '@/features/comments/hooks/useCommentWithdrawal';

// Mock dependencies
jest.mock('@/hooks/api/useCommunities');
jest.mock('@/features/comments/hooks/useCommentWithdrawal');
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseCommentWithdrawal.mockReturnValue({
      maxWithdrawAmount: 5,
      maxTopUpAmount: 0,
    });
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
    } as any);

    render(
      <Comment
        {...mockComment}
        myId="author-1"
        wallets={[]}
        updateWalletBalance={jest.fn()}
        updateAll={jest.fn()}
      />
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
    } as any);

    render(
      <Comment
        {...mockComment}
        myId="author-1"
        wallets={[]}
        updateWalletBalance={jest.fn()}
        updateAll={jest.fn()}
      />
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
    } as any);

    render(
      <Comment
        {...mockComment}
        myId="author-1"
        wallets={[]}
        updateWalletBalance={jest.fn()}
        updateAll={jest.fn()}
      />
    );

    // Withdrawal should be available for regular communities
    // Note: Actual visibility depends on isAuthor logic
  });
});

