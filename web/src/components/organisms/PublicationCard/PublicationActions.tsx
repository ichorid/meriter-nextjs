import React from 'react';
import { Button, Icon } from '@/components/atoms';

export interface PublicationActionsProps {
  onVote: () => void;
  onComment: () => void;
  onShare?: () => void;
  commentCount?: number;
  isLoading?: boolean;
}

export const PublicationCardActions: React.FC<PublicationActionsProps> = ({
  onVote,
  onComment,
  onShare,
  commentCount = 0,
  isLoading = false,
}) => {
  return (
    <div className="flex items-center gap-2 pt-3 border-t border-base-300">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onVote}
        disabled={isLoading}
      >
        <Icon name="thumb_up" size={20} />
        Vote
      </Button>
      
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onComment}
        disabled={isLoading}
      >
        <Icon name="comment" size={20} />
        <span>{commentCount > 0 && commentCount}</span>
      </Button>
      
      {onShare && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onShare}
          disabled={isLoading}
        >
          <Icon name="share" size={20} />
        </Button>
      )}
    </div>
  );
};
