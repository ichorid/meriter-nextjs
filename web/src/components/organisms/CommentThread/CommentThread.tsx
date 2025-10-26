import React from 'react';
import { Card, CardBody } from '@/components/atoms';
import { UserCard, VoteIndicator } from '@/components/molecules';
import { Avatar, Badge, Button, Icon, Divider } from '@/components/atoms';
import { formatDate } from '@/lib/utils/date';

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
    upthanks: number;
    downthanks: number;
    score: number;
    replyCount: number;
    thanks?: number;
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
  const canNest = level < maxLevel;
  
  return (
    <div className="space-y-2">
      <Card compact>
        <CardBody className="p-3">
          <div className="flex gap-2 mb-2">
            <Avatar src={comment.author?.avatarUrl} alt={comment.author?.displayName} size="sm" />
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
                  {comment.metrics?.thanks || 0}
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
        </CardBody>
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
