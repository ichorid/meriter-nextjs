'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';
import {
  useTappalkaProgress,
  useTappalkaPair,
  useTappalkaChoice,
  useTappalkaOnboarding,
} from '../hooks';
import {
  TappalkaHeader,
  TappalkaPostCard,
  TappalkaMeritIcon,
  TappalkaOnboarding,
} from './';
import { cn } from '@/lib/utils';
import { formatMerits } from '@/lib/utils/currency';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/shadcn/dialog';
import { PublicationCardComponent } from '@/components/organisms/Publication';
import { trpc } from '@/lib/trpc/client';
import { useWallets } from '@/hooks/api';

interface TappalkaScreenProps {
  communityId: string;
  onClose: () => void;
}

export const TappalkaScreen: React.FC<TappalkaScreenProps> = ({
  communityId,
  onClose,
}) => {
  const addToast = useToastStore((state) => state.addToast);
  
  // State for drag-and-drop
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [dropTargetPostId, setDropTargetPostId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [votedSessionId, setVotedSessionId] = useState<string | null>(null);
  const [viewingPostId, setViewingPostId] = useState<string | null>(null);

  // Hooks
  const { data: progress, isLoading: progressLoading } = useTappalkaProgress(communityId);
  const { data: pair, isLoading: pairLoading, refetch: refetchPair } = useTappalkaPair(
    communityId,
    { enabled: !!progress && progress.onboardingSeen },
  );
  const submitChoice = useTappalkaChoice();
  const markOnboardingSeen = useTappalkaOnboarding();
  const { data: wallets = [] } = useWallets();

  // Fetch full publication data when viewing
  const { data: viewingPublication, isLoading: isLoadingPublication } = trpc.publications.getById.useQuery(
    { id: viewingPostId! },
    { enabled: !!viewingPostId },
  );

  // Reset voting state when pair changes
  useEffect(() => {
    if (pair && votedSessionId && votedSessionId !== pair.sessionId) {
      setVotedSessionId(null);
      setSelectedPostId(null);
      setDraggedPostId(null);
      setDropTargetPostId(null);
    }
  }, [pair?.sessionId, votedSessionId]);

  // Show onboarding if not seen
  const showOnboarding = progress && !progress.onboardingSeen;

  // Handle onboarding dismiss
  const handleOnboardingDismiss = useCallback(async () => {
    try {
      await markOnboardingSeen.mutateAsync({ communityId });
    } catch (error) {
      console.error('Failed to mark onboarding as seen:', error);
    }
  }, [communityId, markOnboardingSeen]);

  // Check if voting is disabled for current pair
  const isVotingDisabled = pair ? votedSessionId === pair.sessionId : false;

  // Handle drag start
  const handleDragStart = useCallback(() => {
    // Prevent dragging if already voted for this pair
    if (isVotingDisabled) return;
    // Merit icon is being dragged
    setDraggedPostId('merit');
  }, [isVotingDisabled]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedPostId(null);
    setDropTargetPostId(null);
  }, []);

  // Handle drop on post
  const handlePostDrop = useCallback(
    async (postId: string) => {
      // Prevent multiple votes for the same pair
      if (!pair || isSubmitting || !draggedPostId || votedSessionId === pair.sessionId) return;

      const otherPostId = postId === pair.postA.id ? pair.postB.id : pair.postA.id;

      // Immediately mark this session as voted to prevent duplicate votes
      setVotedSessionId(pair.sessionId);
      setSelectedPostId(postId);
      setIsSubmitting(true);
      setDraggedPostId(null);
      setDropTargetPostId(null);

      try {
        const result = await submitChoice.mutateAsync({
          communityId,
          sessionId: pair.sessionId,
          winnerPostId: postId,
          loserPostId: otherPostId,
        });

        // Show success message if reward earned
        if (result.rewardEarned && result.userMeritsEarned) {
          addToast(
            `Поздравляем! Вы получили ${formatMerits(result.userMeritsEarned)} меритов за ${progress?.comparisonsRequired || 10} сравнений!`,
            'success',
          );
        }

        // Quickly switch to next pair (short delay for visual feedback)
        if (result.nextPair) {
          setTimeout(() => {
            refetchPair();
            setSelectedPostId(null);
            setVotedSessionId(null);
          }, 300); // Short delay for visual feedback
        } else if (result.noMorePosts) {
          addToast('Больше нет постов для сравнения', 'info');
          setTimeout(() => {
            setSelectedPostId(null);
            setVotedSessionId(null);
          }, 300);
        } else {
          // Refetch to get next pair
          setTimeout(() => {
            refetchPair();
            setSelectedPostId(null);
            setVotedSessionId(null);
          }, 300);
        }
      } catch (error) {
        console.error('Failed to submit choice:', error);
        const message = error instanceof Error ? error.message : 'Не удалось отправить выбор';
        addToast(message, 'error');
        setSelectedPostId(null);
        setVotedSessionId(null);
      } finally {
        setIsSubmitting(false);
      }
    },
    [pair, isSubmitting, draggedPostId, votedSessionId, communityId, submitChoice, progress, addToast, refetchPair],
  );

  // Handle drag enter (for visual feedback)
  const handleDragEnter = useCallback((postId: string) => {
    if (draggedPostId) {
      setDropTargetPostId(postId);
    }
  }, [draggedPostId]);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDropTargetPostId(null);
  }, []);

  // Loading state
  if (progressLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-base-200">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        <p className="mt-4 text-base-content/70">Загрузка...</p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-base-200">
        <p className="text-base-content/70">Не удалось загрузить данные</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-brand-primary text-white rounded-lg"
        >
          Закрыть
        </button>
      </div>
    );
  }

  // Show onboarding if not seen
  if (showOnboarding) {
    return (
      <div className="flex flex-col min-h-screen bg-base-200">
        <TappalkaOnboarding
          text={progress.onboardingText || ''}
          onDismiss={handleOnboardingDismiss}
          inline={true}
        />
        {/* Show loading while marking onboarding as seen */}
        {markOnboardingSeen.isPending && (
          <div className="fixed inset-0 z-40 bg-black/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
          </div>
        )}
      </div>
    );
  }

  // Empty state (no posts available)
  if (!pairLoading && !pair) {
    return (
      <div className="flex flex-col min-h-screen bg-base-200">
        <TappalkaHeader
          currentComparisons={progress.currentComparisons}
          comparisonsRequired={progress.comparisonsRequired}
          meritBalance={progress.meritBalance}
          onBack={onClose}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-base-content mb-2">
              Нет постов для сравнения
            </h3>
            <p className="text-base-content/70 mb-6">
              В этом сообществе пока нет достаточно постов для сравнения. Попробуйте позже!
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main screen with pair
  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <TappalkaHeader
        currentComparisons={progress.currentComparisons}
        comparisonsRequired={progress.comparisonsRequired}
        meritBalance={progress.meritBalance}
        onBack={onClose}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 gap-6">
        {pairLoading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            <p className="text-base-content/70">Загрузка постов...</p>
          </div>
        ) : pair ? (
          <>
            {/* Posts comparison */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 w-full max-w-6xl">
              {/* Post A */}
              <div className="flex-1 w-full md:max-w-md">
                <TappalkaPostCard
                  post={pair.postA}
                  isSelected={selectedPostId === pair.postA.id}
                  isDropTarget={dropTargetPostId === pair.postA.id}
                  onDrop={() => handlePostDrop(pair.postA.id)}
                  onDragEnter={() => handleDragEnter(pair.postA.id)}
                  onDragLeave={handleDragLeave}
                  onPostClick={() => setViewingPostId(pair.postA.id)}
                  disabled={isVotingDisabled}
                />
              </div>

              {/* VS indicator */}
              <div className="flex-shrink-0">
                <div className="flex flex-col items-center gap-2">
                  <div className="text-2xl md:text-4xl font-bold text-base-content/50">
                    VS
                  </div>
                  {isSubmitting && (
                    <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                  )}
                </div>
              </div>

              {/* Post B */}
              <div className="flex-1 w-full md:max-w-md">
                <TappalkaPostCard
                  post={pair.postB}
                  isSelected={selectedPostId === pair.postB.id}
                  isDropTarget={dropTargetPostId === pair.postB.id}
                  onDrop={() => handlePostDrop(pair.postB.id)}
                  onDragEnter={() => handleDragEnter(pair.postB.id)}
                  onDragLeave={handleDragLeave}
                  onPostClick={() => setViewingPostId(pair.postB.id)}
                  disabled={isVotingDisabled}
                />
              </div>
            </div>

            {/* Merit icon (draggable) */}
            <div className="flex flex-col items-center gap-2 mt-4">
              <p className="text-sm text-base-content/60 mb-2">
                Перетащите мерит на пост, который вам больше нравится
              </p>
              <TappalkaMeritIcon
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                size="lg"
                disabled={isVotingDisabled}
                className={cn(
                  'transition-all duration-200',
                  draggedPostId && 'opacity-70 scale-90',
                  isVotingDisabled && 'opacity-50 cursor-not-allowed',
                )}
              />
            </div>
          </>
        ) : null}
      </div>

      {/* Publication View Modal */}
      <Dialog open={!!viewingPostId} onOpenChange={(open) => !open && setViewingPostId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Просмотр поста</DialogTitle>
          {isLoadingPublication ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
          ) : viewingPublication ? (
            <PublicationCardComponent
              publication={viewingPublication as any}
              wallets={wallets}
              showCommunityAvatar={false}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

