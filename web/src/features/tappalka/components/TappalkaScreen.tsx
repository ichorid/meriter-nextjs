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

  // Hooks
  const { data: progress, isLoading: progressLoading } = useTappalkaProgress(communityId);
  const { data: pair, isLoading: pairLoading, refetch: refetchPair } = useTappalkaPair(
    communityId,
    { enabled: !!progress && progress.onboardingSeen },
  );
  const submitChoice = useTappalkaChoice();
  const markOnboardingSeen = useTappalkaOnboarding();

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

  // Handle drag start
  const handleDragStart = useCallback(() => {
    // Merit icon is being dragged
    setDraggedPostId('merit');
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedPostId(null);
    setDropTargetPostId(null);
  }, []);

  // Handle drop on post
  const handlePostDrop = useCallback(
    async (postId: string) => {
      if (!pair || isSubmitting || !draggedPostId) return;

      const otherPostId = postId === pair.postA.id ? pair.postB.id : pair.postA.id;

      setSelectedPostId(postId);
      setIsSubmitting(true);

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

        // If nextPair is provided, use it; otherwise refetch
        if (result.nextPair) {
          // Update pair in cache would be handled by the mutation
          // For now, we'll refetch to get the new pair
          setTimeout(() => {
            refetchPair();
            setSelectedPostId(null);
          }, 1000); // Show animation for 1 second
        } else if (result.noMorePosts) {
          addToast('Больше нет постов для сравнения', 'info');
          setTimeout(() => {
            setSelectedPostId(null);
          }, 1000);
        } else {
          // Refetch to get next pair
          setTimeout(() => {
            refetchPair();
            setSelectedPostId(null);
          }, 1000);
        }
      } catch (error) {
        console.error('Failed to submit choice:', error);
        const message = error instanceof Error ? error.message : 'Не удалось отправить выбор';
        addToast(message, 'error');
        setSelectedPostId(null);
      } finally {
        setIsSubmitting(false);
        setDraggedPostId(null);
        setDropTargetPostId(null);
      }
    },
    [pair, isSubmitting, draggedPostId, communityId, submitChoice, progress, addToast, refetchPair],
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
                className={cn(
                  'transition-all duration-200',
                  draggedPostId && 'opacity-70 scale-90',
                )}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

