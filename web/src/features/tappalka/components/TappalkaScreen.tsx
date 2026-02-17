'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  const [isTokenHovered, setIsTokenHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showDragHint, setShowDragHint] = useState(false);
  const [dragHintShown, setDragHintShown] = useState(0);
  const dragHintTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      setIsDragging(false);
    }
  }, [pair?.sessionId, votedSessionId]);

  // Check if voting is disabled for current pair (must be before useEffect that uses it)
  const isVotingDisabled = pair ? votedSessionId === pair.sessionId : false;

  // Show drag hint animation logic
  useEffect(() => {
    // Check if user has seen drag hint before
    const hasSeenHint = typeof window !== 'undefined' && localStorage.getItem('tappalka_drag_hint_seen') === 'true';
    
    if (!pair || pairLoading || isVotingDisabled || hasSeenHint || dragHintShown >= 2) {
      return;
    }

    // Show hint on first entry or after 4 seconds of inactivity
    const showHint = () => {
      if (!isDragging && !isTokenHovered && dragHintShown < 2) {
        setShowDragHint(true);
        setDragHintShown(prev => prev + 1);
        
        // Hide after animation (flag set on real drag, not here)
        setTimeout(() => setShowDragHint(false), 1400);
      }
    };

    // Show immediately on first entry
    if (dragHintShown === 0) {
      const timer = setTimeout(showHint, 500);
      return () => clearTimeout(timer);
    }

    // Show after 4 seconds of inactivity
    inactivityTimeoutRef.current = setTimeout(() => {
      if (!isDragging && !isTokenHovered && dragHintShown < 2) {
        showHint();
      }
    }, 4000);

    return () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [pair, pairLoading, isVotingDisabled, isDragging, isTokenHovered, dragHintShown]);

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
    // Prevent dragging if already voted for this pair
    if (isVotingDisabled) return;
    // Merit icon is being dragged - mark hint as seen (never show again after real drag)
    if (typeof window !== 'undefined') {
      localStorage.setItem('tappalka_drag_hint_seen', 'true');
    }
    setDraggedPostId('merit');
    setIsDragging(true);
    setShowDragHint(false);
    // Clear inactivity timeout
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
  }, [isVotingDisabled]);

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

  // Handle drag end (releasePoint for mobile touch: drop on card under finger)
  const handleDragEnd = useCallback(
    (releasePoint?: { x: number; y: number }) => {
      if (releasePoint && typeof document !== 'undefined') {
        const el = document.elementFromPoint(releasePoint.x, releasePoint.y);
        const card = el?.closest('[data-tappalka-post-id]');
        const postId = card?.getAttribute('data-tappalka-post-id');
        if (postId && (postId === pair?.postA.id || postId === pair?.postB.id)) {
          handlePostDrop(postId);
        }
      }
      setDraggedPostId(null);
      setDropTargetPostId(null);
      setIsDragging(false);
    },
    [pair?.postA.id, pair?.postB.id, handlePostDrop],
  );

  // Touch drag move: update drop target from element under finger (mobile)
  const handleTouchDragMove = useCallback((x: number, y: number) => {
    if (typeof document === 'undefined') return;
    const el = document.elementFromPoint(x, y);
    const card = el?.closest('[data-tappalka-post-id]');
    const postId = card?.getAttribute('data-tappalka-post-id');
    if (postId && (postId === pair?.postA.id || postId === pair?.postB.id)) {
      setDropTargetPostId(postId);
    } else {
      setDropTargetPostId(null);
    }
  }, [pair?.postA.id, pair?.postB.id]);

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
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-base-200">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        <p className="mt-4 text-base-content/70">Загрузка...</p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-base-200">
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

  // Show onboarding if not seen (single surface inside dialog, no nested card)
  if (showOnboarding) {
    return (
      <>
        <TappalkaOnboarding
          text={progress.onboardingText || ''}
          onDismiss={handleOnboardingDismiss}
          inline={true}
        />
        {markOnboardingSeen.isPending && (
          <div className="absolute inset-0 z-40 bg-base-100/80 flex items-center justify-center rounded-[inherit]">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
          </div>
        )}
      </>
    );
  }

  // Empty state (no posts available)
  if (!pairLoading && !pair) {
    return (
      <div className="flex flex-col min-h-0 bg-base-200">
        <TappalkaHeader
          currentComparisons={progress.currentComparisons}
          comparisonsRequired={progress.comparisonsRequired}
          meritBalance={progress.meritBalance}
          onBack={onClose}
        />
        <div className="flex flex-col items-center justify-center p-6">
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
    <div className="flex flex-col min-h-0 bg-base-200 overflow-hidden">
      <TappalkaHeader
        currentComparisons={progress.currentComparisons}
        comparisonsRequired={progress.comparisonsRequired}
        meritBalance={progress.meritBalance}
        onBack={onClose}
      />

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center md:justify-start p-4 md:p-6 gap-4">
        {pairLoading ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            <p className="text-base-content/70">Загрузка постов...</p>
          </div>
        ) : pair ? (
          <>
            {/* Posts comparison - max-w-full so we fit inside dialog (max-w-4xl) */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-6 w-full max-w-full">
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
                  isTokenHovered={isTokenHovered}
                  isDragging={isDragging}
                />
              </div>

              {/* VS indicator and Merit icon (mobile: between posts, desktop: VS only) */}
              <div className="flex-shrink-0">
                <div className="flex flex-col items-center gap-6 md:gap-2">
                  {/* VS indicator - hidden on mobile, shown on desktop */}
                  <div className="hidden md:flex flex-col items-center gap-2">
                    <div className="text-4xl font-bold text-base-content/50">
                      VS
                    </div>
                    {isSubmitting && (
                      <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                    )}
                  </div>
                  
                  {/* Merit icon - shown on mobile between posts, hidden on desktop */}
                  <div className="flex md:hidden flex-col items-center gap-2 relative">
                    <div className="relative">
                      <TappalkaMeritIcon
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onHoverChange={setIsTokenHovered}
                        onTouchDragMove={handleTouchDragMove}
                        size="lg"
                        disabled={isVotingDisabled}
                        isTokenHovered={isTokenHovered}
                        isDragging={isDragging}
                        className={cn(
                          'transition-all duration-200',
                          draggedPostId && 'opacity-70 scale-90',
                          isVotingDisabled && 'opacity-50 cursor-not-allowed',
                        )}
                      />
                      {showDragHint && (
                        <div
                          className="absolute -top-12 left-1/2 -translate-x-1/2 pointer-events-none z-50 animate-drag-hint-mobile"
                        >
                          <div className="w-8 h-8 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg">
                            <svg
                              className="w-5 h-5 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-base-content/50 text-center max-w-[180px]">
                      Зажмите и перетащите мерит на выбранный пост
                    </p>
                  </div>
                  
                  {/* Loading indicator for mobile */}
                  {isSubmitting && (
                    <div className="md:hidden">
                      <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                    </div>
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
                  isTokenHovered={isTokenHovered}
                  isDragging={isDragging}
                />
              </div>
            </div>

            {/* Merit icon (draggable) - desktop only */}
            <div className="hidden md:flex flex-col items-center gap-2 mt-4 relative">
              <p className="text-sm text-base-content/60 mb-2">
                Зажмите и перетащите мерит на выбранный пост
              </p>
              <div className="relative">
                <TappalkaMeritIcon
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onHoverChange={setIsTokenHovered}
                  onTouchDragMove={handleTouchDragMove}
                  size="lg"
                  disabled={isVotingDisabled}
                  isTokenHovered={isTokenHovered}
                  isDragging={isDragging}
                  className={cn(
                    'transition-all duration-200',
                    draggedPostId && 'opacity-70 scale-90',
                    isVotingDisabled && 'opacity-50 cursor-not-allowed',
                  )}
                />
                
                {/* Drag hint animation - ghost cursor/hand (pointer-events: none) */}
                {showDragHint && (
                  <div
                    className="absolute -top-12 left-1/2 -translate-x-1/2 pointer-events-none z-50 animate-drag-hint"
                  >
                    <div className="relative">
                      {/* Ghost cursor/hand icon */}
                      <div className="w-8 h-8 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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

