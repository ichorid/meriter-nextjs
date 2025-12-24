'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/shadcn/card';
import { UserCard, VoteIndicator } from '@/components/molecules';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { Badge } from '@/components/atoms/Badge/Badge';
import { Button } from '@/components/ui/shadcn/button';
import { Icon } from '@/components/atoms/Icon/Icon';
import { Divider } from '@/components/atoms/Divider/Divider';
import { User } from 'lucide-react';
import { formatDate } from '@/shared/lib/date';
import { routes } from '@/lib/constants/routes';

// Local Comment type definition
interface Comment {
  id: string;
  authorId: string;
  author?: {
    avatarUrl?: string;
    displayName: string;
  };
  content: string;
  createdAt: string;
  updatedAt: string;
  authorVoteAmount?: number;
  metrics: {
    upvotes: number;
    downvotes: number;
    score: number;
    replyCount: number;
    votes?: number;
  };
}

export interface CommentThreadProps {
  comment: Comment;
  replies?: Comment[];
  onReply?: (commentId: string) => void;
  onVote?: (commentId: string, direction: 'plus' | 'minus') => void;
  showVoteIndicator?: boolean;
  level?: number;
  maxLevel?: number;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  comment,
  replies = [],
  onReply,
  onVote,
  showVoteIndicator = true,
  level = 0,
  maxLevel = 5,
}) => {
  const router = useRouter();
  const canNest = level < maxLevel;
  
  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (comment.authorId) {
      router.push(routes.userProfile(comment.authorId));
    }
  };
  
  return (
    <div className="space-y-2">
      <Card compact>
        <CardContent className="p-3">
          <div className="flex gap-2 mb-2">
            <Avatar 
              src={comment.author?.avatarUrl} 
              alt={comment.author?.displayName} 
              size="sm"
              onClick={comment.authorId ? handleAvatarClick : undefined}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{comment.author?.displayName}</span>
                <Badge variant="secondary" size="xs">
                  {formatDate(comment.createdAt, 'relative')}
                </Badge>
                {showVoteIndicator && comment.authorVoteAmount !== undefined && (
                  <VoteIndicator amount={comment.authorVoteAmount} />
                )}
              </div>
              <p className="text-sm text-base-content/80">{comment.content}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pt-2 border-t border-base-300">
            {onReply && canNest && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReply(comment.id)}
              >
                <Icon name="reply" size={16} />
                Reply
              </Button>
            )}
            
            {onVote && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onVote(comment.id, 'plus')}
                >
                  <Icon name="thumb_up" size={16} />
                  {comment.metrics?.votes || 0}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onVote(comment.id, 'minus')}
                >
                  <Icon name="thumb_down" size={16} />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      
      {replies.length > 0 && canNest && (
        <div className="ml-6 space-y-2">
          {replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onVote={onVote}
              showVoteIndicator={showVoteIndicator}
              level={level + 1}
              maxLevel={maxLevel}
            />
          ))}
        </div>
      )}
    </div>
  );
};
