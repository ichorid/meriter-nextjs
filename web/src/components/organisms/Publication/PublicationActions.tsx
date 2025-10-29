// Publication actions component
'use client';

import React, { useState } from 'react';
import { BarVoteUnified } from '@shared/components/bar-vote-unified';
import { BottomPortal } from '@shared/components/bottom-portal';
import { FormComment } from '@features/comments/components/form-comment';
import { useFreeBalance } from '@/hooks/api/useWallet';
import { useCommunityQuotas } from '@/hooks/api/useCommunityQuota';
import { useAuth } from '@/contexts/AuthContext';

// Local Publication type definition
interface Publication {
  id: string;
  slug?: string;
  content?: string;
  createdAt: string;
  communityId?: string;
  metrics?: {
    score?: number;
  };
  [key: string]: unknown;
}

interface PublicationActionsProps {
  publication: Publication;
  onVote: (direction: 'plus' | 'minus', amount: number) => void;
  onComment: (comment: string, amount: number, directionPlus: boolean) => void;
  activeCommentHook: readonly [string | null, (commentId: string | null) => void];
  isVoting?: boolean;
  isCommenting?: boolean;
  maxPlus?: number;
  maxMinus?: number;
  className?: string;
}

export const PublicationActions: React.FC<PublicationActionsProps> = ({
  publication,
  onVote,
  onComment,
  activeCommentHook,
  isVoting = false,
  isCommenting = false,
  maxPlus = 100,
  maxMinus = 100,
  className = '',
}) => {
  // Use hook directly to avoid closure issues
  const activeComment = activeCommentHook[0];
  const setActiveComment = activeCommentHook[1];
  // Normalize IDs to strings for comparison
  const publicationId = String(publication.id || publication.slug || '');
  const isActiveComment = String(activeComment || '') === publicationId;
  
  // Debug logging - track state changes
  React.useEffect(() => {
    console.log('🔍 PublicationActions render:', {
      publicationId,
      activeComment,
      isActiveComment,
      hookValue: activeCommentHook[0],
      hookLength: activeCommentHook?.length,
      setterType: typeof activeCommentHook?.[1],
      hookDirect: activeCommentHook
    });
  });
  
  React.useEffect(() => {
    if (isActiveComment) {
      console.log('✅ Form should be visible!', { activeComment, publicationId, matches: activeComment === publicationId });
    } else {
      console.log('❌ Form NOT visible:', { activeComment, publicationId, matches: activeComment === publicationId });
    }
  }, [isActiveComment, activeComment, publicationId]);
  
  // Local state for vote form - delta can be positive or negative
  const [comment, setComment] = useState('');
  const [delta, setDelta] = useState(0);
  const [error, setError] = useState('');
  
  const { user } = useAuth();
  
  // Get quota for this community (daily free voting quota)
  const { quotasMap } = useCommunityQuotas(publication.communityId ? [publication.communityId] : []);
  const quotaData = publication.communityId ? quotasMap.get(publication.communityId) : null;
  const quotaRemaining = quotaData?.remainingToday ?? 0;
  
  // Also try useFreeBalance as fallback (different API endpoint)
  const { data: freeBalance } = useFreeBalance(publication.communityId);
  const freePlus = quotaRemaining > 0 ? quotaRemaining : (typeof freeBalance === 'number' ? freeBalance : 0);
  const freeMinus = 0; // Downvotes typically don't have free quota
  
  // User can vote if they have either quota OR wallet balance
  // maxPlus is the wallet balance passed from parent
  const walletBalance = maxPlus || 0;
  const hasPoints = freePlus > 0 || walletBalance > 0;
  
  // Calculate maxMinus: limit by remaining quota since downvotes also consume quota
  // Both upvotes and downvotes consume quota, so maxMinus should not exceed quotaRemaining
  // When using quota (which we do by default), downvotes are limited by remaining quota
  // Fallback to wallet balance or passed maxMinus prop if quota data isn't available
  const calculatedMaxMinus = quotaRemaining > 0 
    ? Math.min(quotaRemaining, Math.max(walletBalance || 0, maxMinus || 0))
    : Math.max(walletBalance || 0, maxMinus || 0, 1);
  
  React.useEffect(() => {
    if (isActiveComment) {
      console.log('🎨 About to render FormComment inside BottomPortal', { 
        isActiveComment, 
        activeComment, 
        publicationId,
        hasPoints,
        freePlus,
        quotaRemaining,
        walletBalance,
        maxPlus,
        quotaData: quotaData ? { remainingToday: quotaData.remainingToday } : null
      });
    }
  }, [isActiveComment, activeComment, publicationId, hasPoints, freePlus, quotaRemaining, walletBalance, maxPlus, quotaData]);

  const handleCommentToggle = () => {
    setActiveComment(isActiveComment ? null : publication.id);
    if (isActiveComment) {
      // Reset form when closing
      setComment('');
      setDelta(0);
      setError('');
    }
  };

  const handleVoteClick = () => {
    // Show the vote form popup (using same state as comment form)
    const idToSet = String(publication.id || publication.slug || '');
    console.log('🔘 Vote button clicked!', { 
      publicationId: publication.id, 
      slug: publication.slug,
      idToSet,
      currentActiveComment: activeComment,
      setActiveCommentType: typeof setActiveComment,
      isFunction: typeof setActiveComment === 'function',
      hookStructure: { value: activeCommentHook[0], setter: typeof activeCommentHook[1] }
    });
    
    if (typeof setActiveComment !== 'function') {
      console.error('❌ setActiveComment is not a function!', { setActiveComment, activeCommentHook });
      return;
    }
    
    try {
      console.log('🔘 Calling setActiveComment with:', idToSet, 'type:', typeof idToSet);
      setActiveComment(idToSet);
      console.log('🔘 setActiveComment called successfully');
      
      // Force a state check after a brief delay to see if state updated
      setTimeout(() => {
        const currentValue = String(activeCommentHook[0] || '');
        console.log('🔘 State check after 100ms:', { 
          activeComment: currentValue, 
          expectedValue: idToSet,
          publicationId, 
          matches: currentValue === publicationId,
          stateChanged: String(currentValue) !== String(activeComment),
          bothStrings: { current: typeof currentValue, expected: typeof idToSet }
        });
      }, 100);
      
      setDelta(0);
      setComment('');
      setError('');
    } catch (error) {
      console.error('❌ Error calling setActiveComment:', error);
    }
  };

  const handleCommentAdd = async (directionPlus: boolean) => {
    if (delta === 0) {
      setError('Please adjust the slider to vote');
      return;
    }

    try {
      setError('');
      // Pass the actual delta value (can be negative for downvotes)
      // The amount will be negative for downvotes, positive for upvotes
      await onComment(comment, delta, directionPlus);
      // Reset form after successful submit
      setComment('');
      setDelta(0);
      setActiveComment(null);
    } catch (err: any) {
      console.error('Error submitting vote/comment:', err);
      let errorMessage = 'Failed to submit vote';
      if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      setError(errorMessage);
    }
  };

  const handleClose = () => {
    setActiveComment(null);
    setComment('');
    setDelta(0);
    setError('');
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <BarVoteUnified
          score={publication.metrics?.score || 0}
          onVoteClick={handleVoteClick}
          isAuthor={false}
          commentCount={0}
          onCommentClick={handleCommentToggle}
        />
      </div>

      {isActiveComment && (
        <BottomPortal>
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-auto">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
              onClick={handleClose}
            />
            {/* Form Container */}
            <div className="relative z-10 w-full max-w-md bg-base-100 rounded-t-2xl shadow-2xl pointer-events-auto max-h-[90vh] overflow-y-auto">
              <FormComment
                uid={publication.id || publication.slug || 'unknown'}
                hasPoints={hasPoints}
                comment={comment}
                setComment={setComment}
                amount={delta}
                setAmount={setDelta}
                free={freePlus}
                maxPlus={Math.max(freePlus, walletBalance)}
                maxMinus={calculatedMaxMinus}
                commentAdd={handleCommentAdd}
                error={error}
                onClose={handleClose}
              />
            </div>
          </div>
        </BottomPortal>
      )}
    </div>
  );
};
