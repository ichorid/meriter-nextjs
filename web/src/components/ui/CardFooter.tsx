'use client';

import React from 'react';
import { Heart, MessageCircle, Share2, MoreVertical } from 'lucide-react';
import { BrandButton } from './BrandButton';

interface CardFooterProps {
  likes?: number;
  comments?: number;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onMore?: () => void;
  isLiked?: boolean;
  showActions?: boolean;
  className?: string;
}

export function CardFooter({
  likes = 0,
  comments = 0,
  onLike,
  onComment,
  onShare,
  onMore,
  isLiked = false,
  showActions = true,
  className = '',
}: CardFooterProps) {
  if (!showActions) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between pt-4 border-t border-brand-secondary/10 ${className}`}>
      {/* Action Buttons */}
      <div className="flex items-center space-x-4">
        {onLike && (
          <button
            onClick={onLike}
            className="flex items-center space-x-2 text-brand-text-secondary hover:text-brand-primary transition-colors"
          >
            <Heart
              size={18}
              className={isLiked ? 'fill-brand-primary text-brand-primary' : ''}
            />
            {likes > 0 && (
              <span className="text-sm">{likes}</span>
            )}
          </button>
        )}

        {onComment && (
          <button
            onClick={onComment}
            className="flex items-center space-x-2 text-brand-text-secondary hover:text-brand-primary transition-colors"
          >
            <MessageCircle size={18} />
            {comments > 0 && (
              <span className="text-sm">{comments}</span>
            )}
          </button>
        )}

        {onShare && (
          <button
            onClick={onShare}
            className="flex items-center space-x-2 text-brand-text-secondary hover:text-brand-primary transition-colors"
          >
            <Share2 size={18} />
          </button>
        )}
      </div>

      {/* More Menu */}
      {onMore && (
        <button
          onClick={onMore}
          className="text-brand-text-secondary hover:text-brand-primary transition-colors"
        >
          <MoreVertical size={18} />
        </button>
      )}
    </div>
  );
}

