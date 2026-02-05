'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { ImageGalleryDisplay } from '@shared/components/image-gallery-display';
import type { TappalkaPost } from '../types';
import { cn } from '@/lib/utils';
import { formatMerits } from '@/lib/utils/currency';
import DOMPurify from 'dompurify';

interface TappalkaPostCardProps {
  post: TappalkaPost;
  isSelected?: boolean;
  isDropTarget?: boolean;
  onDrop?: () => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  onPostClick?: () => void;
  disabled?: boolean;
}

export const TappalkaPostCard: React.FC<TappalkaPostCardProps> = ({
  post,
  isSelected = false,
  isDropTarget = false,
  onDrop,
  onDragEnter,
  onDragLeave,
  onPostClick,
  disabled = false,
}) => {
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled || !onDrop) return;
      e.preventDefault();
      e.stopPropagation();
    },
    [onDrop, disabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled || !onDrop) return;
      e.preventDefault();
      e.stopPropagation();
      onDrop();
    },
    [onDrop, disabled],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled || !onDrop) return;
      e.preventDefault();
      e.stopPropagation();
      onDragEnter?.();
    },
    [onDrop, onDragEnter, disabled],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      // Only trigger if we're actually leaving the card (not entering a child)
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      
      if (
        x < rect.left ||
        x > rect.right ||
        y < rect.top ||
        y > rect.bottom
      ) {
        onDragLeave?.();
      }
    },
    [onDragLeave],
  );

  // Get author initials for avatar fallback
  const getAuthorInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Check if content contains HTML tags
  const isHtmlContent = useCallback((text: string): boolean => {
    return text && typeof text === 'string' && text.includes('<') && text.includes('>');
  }, []);

  // Sanitize HTML content
  const sanitizeHtml = useCallback((html: string): string => {
    if (typeof window === 'undefined') return html;
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote', 'code'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
  }, []);

  const titleIsHtml = useMemo(() => isHtmlContent(post.title || ''), [post.title, isHtmlContent]);
  const descriptionIsHtml = useMemo(() => isHtmlContent(post.description || ''), [post.description, isHtmlContent]);

  const sanitizedTitle = useMemo(() => {
    if (titleIsHtml && post.title) {
      return sanitizeHtml(post.title);
    }
    return post.title;
  }, [post.title, titleIsHtml, sanitizeHtml]);

  const sanitizedDescription = useMemo(() => {
    if (descriptionIsHtml && post.description) {
      return sanitizeHtml(post.description);
    }
    return post.description;
  }, [post.description, descriptionIsHtml, sanitizeHtml]);

  // Track pointer position to distinguish click from drag
  const [pointerDownPos, setPointerDownPos] = useState<{ x: number; y: number } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);

  const handleCardClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Don't open modal if disabled
      if (disabled) return;
      
      // Don't open modal if no handler provided
      if (!onPostClick) return;
      
      // If we have drag handlers, check if pointer moved (was a drag, not a click)
      if (onDrop && pointerDownPos) {
        const distance = Math.sqrt(
          Math.pow(e.clientX - pointerDownPos.x, 2) + Math.pow(e.clientY - pointerDownPos.y, 2)
        );
        // If pointer moved more than 5px, it was a drag, not a click
        if (distance > 5 || hasMoved) {
          return;
        }
      }
      
      // Don't open modal if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      onPostClick();
    },
    [onPostClick, disabled, onDrop, pointerDownPos, hasMoved],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only track pointer position if we have drag handlers
    if (onDrop) {
      setPointerDownPos({ x: e.clientX, y: e.clientY });
      setHasMoved(false);
    }
  }, [onDrop]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Check if pointer moved significantly (drag, not click)
    if (onDrop && pointerDownPos) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - pointerDownPos.x, 2) + Math.pow(e.clientY - pointerDownPos.y, 2)
      );
      if (distance > 5) {
        setHasMoved(true);
      }
    }
  }, [onDrop, pointerDownPos]);

  const handlePointerUp = useCallback(() => {
    // Don't clear immediately - let click handler check first
    // Clear after click handler has had time to execute
    setTimeout(() => {
      setPointerDownPos(null);
      setHasMoved(false);
    }, 150);
  }, []);

  return (
    <div
      className={cn(
        'relative flex flex-col bg-base-100 rounded-xl shadow-lg overflow-hidden transition-all duration-300',
        'border-2',
        isSelected
          ? 'border-green-500 shadow-green-500/20'
          : isDropTarget
            ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 shadow-blue-400/20'
            : 'border-base-300 dark:border-base-700',
        (onDrop || onPostClick) && !disabled && 'cursor-pointer',
        disabled && 'opacity-75 cursor-not-allowed',
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleCardClick}
    >
      {/* Image */}
      {post.imageUrl && (
        <div className="w-full h-48 overflow-hidden bg-base-200">
          <ImageGalleryDisplay
            images={[post.imageUrl]}
            altPrefix={post.title ? `${post.title} - Image` : 'Post image'}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Title */}
        {post.title && (
          titleIsHtml ? (
            <div
              className="text-lg font-semibold text-base-content line-clamp-2 prose prose-sm dark:prose-invert max-w-none [&>*]:!my-0 [&>p]:!mb-0"
              dangerouslySetInnerHTML={{ __html: sanitizedTitle }}
            />
          ) : (
            <h3 className="text-lg font-semibold text-base-content line-clamp-2">
              {post.title}
            </h3>
          )
        )}

        {/* Description */}
        {post.description && (
          descriptionIsHtml ? (
            <div
              className="text-sm text-base-content/70 line-clamp-3 flex-1 prose prose-sm dark:prose-invert max-w-none [&>*]:!my-0 [&>p]:!mb-0"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          ) : (
            <p className="text-sm text-base-content/70 line-clamp-3 flex-1">
              {post.description}
            </p>
          )
        )}

        {/* Author */}
        <div className="flex items-center gap-2 pt-2 border-t border-base-300 dark:border-base-700">
          <Avatar className="h-8 w-8">
            {post.authorAvatarUrl ? (
              <AvatarImage src={post.authorAvatarUrl} alt={post.authorName} />
            ) : null}
            <AvatarFallback className="text-xs">
              {getAuthorInitials(post.authorName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-base-content truncate">
              {post.authorName}
            </span>
            {post.rating !== undefined && (
              <span className="text-xs text-base-content/60">
                {post.rating > 0 ? `+${formatMerits(post.rating)}` : formatMerits(post.rating)} меритов
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <div className="bg-green-500 text-white rounded-full p-1.5 shadow-lg">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Drop target overlay */}
      {isDropTarget && (
        <div className="absolute inset-0 bg-blue-400/20 dark:bg-blue-500/20 border-2 border-dashed border-blue-400 dark:border-blue-500 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="text-blue-600 dark:text-blue-400 font-semibold text-lg">
            Отпустите здесь
          </div>
        </div>
      )}
    </div>
  );
};

