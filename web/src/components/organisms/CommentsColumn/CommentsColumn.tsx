'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useComments } from '@/shared/hooks/use-comments';
import { useTranslations } from 'next-intl';
import { CommentsList } from '@/lib/comments/components/CommentsList';
import { buildTree } from '@/lib/comments/tree';
import { transformComments } from '@/lib/comments/utils/transform';
// Gluestack UI components
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Divider } from '@/components/ui/divider';

export interface CommentsColumnProps {
  publicationSlug: string;
  communityId: string;
  balance: any;
  wallets: any[];
  myId?: string;
  highlightTransactionId?: string;
  activeCommentHook: [string | null, React.Dispatch<React.SetStateAction<string | null>>];
  activeSlider: string | null;
  setActiveSlider: (id: string | null) => void;
  activeWithdrawPost: string | null;
  setActiveWithdrawPost: (id: string | null) => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

/**
 * Comments column component that displays comments for a selected publication
 * Renders in a separate column on desktop, or in a drawer/modal on mobile
 */
export const CommentsColumn: React.FC<CommentsColumnProps> = ({
  publicationSlug,
  communityId,
  balance,
  wallets,
  myId,
  highlightTransactionId,
  activeCommentHook,
  activeSlider,
  setActiveSlider,
  activeWithdrawPost,
  setActiveWithdrawPost,
  onBack,
  showBackButton = false,
}) => {
  const router = useRouter();
  const t = useTranslations('home');
  
  // Sort state for comments
  const [sortBy, setSortBy] = useState<'recent' | 'voted'>('recent');
  
  // Get comments data - useComments hook manages comment state
  // API provides enriched data (author, vote transaction fields)
  const {
    comments,
  } = useComments(
    false, // forTransaction
    publicationSlug,
    '', // transactionId
    balance,
    async () => {}, // updBalance - mutations handle invalidation
    0, // plusGiven - not used for display only
    0, // minusGiven - not used for display only
    activeCommentHook,
    true, // onlyPublication - show comments by default
    communityId, // communityId
    wallets, // wallets array for balance lookup
    sortBy // sort preference
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      // Default: remove post query param
      const params = new URLSearchParams(window.location.search);
      params.delete('post');
      router.push(window.location.pathname + (params.toString() ? `?${params.toString()}` : ''));
    }
  };

  // Transform Meriter comments to template format and build tree
  const commentTree = useMemo(() => {
    if (!comments || comments.length === 0) {
      return [];
    }
    // Transform comments from Meriter format to template format
    const transformedComments = transformComments(comments as any);
    
    // Build tree structure from flat list
    const tree = buildTree(transformedComments);
    return tree;
  }, [comments]);

  return (
    <Box height="100%" flexDirection="column" bg="$white" borderLeftWidth={1} borderColor="$borderLight300">
      {/* Header with close/back button and sort toggle */}
      <VStack borderBottomWidth={1} borderColor="$borderLight300" bg="$gray50">
        <HStack space="sm" alignItems="center" p="$4">
          {(showBackButton || onBack) ? (
            <>
              <Button
                variant="link"
                size="sm"
                onPress={handleBack}
              >
                <HStack space="sm" alignItems="center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <ButtonText>Back</ButtonText>
                </HStack>
              </Button>
              <Heading size="lg" fontWeight="$semibold" flex={1}>Comments</Heading>
              <Button
                variant="link"
                size="sm"
                onPress={handleBack}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </>
          ) : (
            <Heading size="lg" fontWeight="$semibold" flex={1}>Comments</Heading>
          )}
        </HStack>
        {/* Sort Toggle */}
        <HStack space="sm" justifyContent="flex-end" px="$4" pb="$3">
          <HStack space="xs">
            <Button
              variant={sortBy === 'recent' ? 'solid' : 'outline'}
              size="sm"
              onPress={() => setSortBy('recent')}
            >
              <ButtonText>{t('sort.recent')}</ButtonText>
            </Button>
            <Button
              variant={sortBy === 'voted' ? 'solid' : 'outline'}
              size="sm"
              onPress={() => setSortBy('voted')}
            >
              <ButtonText>{t('sort.voted')}</ButtonText>
            </Button>
          </HStack>
        </HStack>
      </VStack>

      {/* Comments list with tree navigation */}
      <Box flex={1} overflowY="auto" p="$4">
        {commentTree.length > 0 ? (
          <CommentsList 
            roots={commentTree}
            myId={myId}
            balance={balance}
            wallets={wallets}
            communityId={communityId}
            publicationSlug={publicationSlug}
            activeCommentHook={activeCommentHook}
            activeSlider={activeSlider}
            setActiveSlider={setActiveSlider}
            activeWithdrawPost={activeWithdrawPost}
            setActiveWithdrawPost={setActiveWithdrawPost}
            highlightTransactionId={highlightTransactionId}
            showCommunityAvatar={false}
            isDetailPage={false}
          />
        ) : (
          <Box flex={1} alignItems="center" justifyContent="center">
            <Text color="$textLight600">No comments yet</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

