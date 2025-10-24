// Publication actions component
'use client';

import React from 'react';
import { VoteBar } from '@/components/molecules/VoteBar';
import { Button } from '@/components/atoms/Button';
import { CommentForm } from '@/components/molecules/CommentForm';
import { BottomPortal } from '@shared/components/bottom-portal';
import type { Publication } from '@/types/entities';

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
  const [activeComment, setActiveComment] = activeCommentHook;
  const isActiveComment = activeComment === publication._id;

  const handleCommentToggle = () => {
    setActiveComment(isActiveComment ? null : publication._id);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <VoteBar
          plus={publication.plus}
          minus={publication.minus}
          sum={publication.sum}
          onVote={onVote}
          maxPlus={maxPlus}
          maxMinus={maxMinus}
          disabled={isVoting}
        />
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCommentToggle}
            disabled={isCommenting}
          >
            Comment
          </Button>
        </div>
      </div>

      {isActiveComment && (
        <BottomPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Add Comment</h3>
              <CommentForm
                onSubmit={onComment}
                onCancel={() => setActiveComment(null)}
                maxAmount={maxPlus}
                loading={isCommenting}
              />
            </div>
          </div>
        </BottomPortal>
      )}
    </div>
  );
};
