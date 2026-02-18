'use client';

import React, { useCallback, useMemo } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { ImageGalleryDisplay } from '@shared/components/image-gallery-display';
import { useMediaQuery } from '@/hooks/useMediaQuery';
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
  isTokenHovered?: boolean; // Token is being hovered
  isDragging?: boolean; // Token is being dragged
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
  isTokenHovered = false,
  isDragging = false,
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

  const isMobileCarousel = useMediaQuery('(max-width: 767px)');
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

  const handleCardClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !onPostClick) return;
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('img') ||
        target.closest('[data-gallery-preview]') ||
        target.closest('[class*="image-gallery"]') ||
        target.closest('[class*="gallery"]')
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      onPostClick();
    },
    [onPostClick, disabled],
  );

  // Drop zone glow: accentColor rgba(120, 160, 255)
  // Idle: ~0.2 of hover opacity (very subtle outline)
  // Hover token: glow ×1.6
  // During drag: glow ×2.2 + 1px border accent 0.35
  const accentRgb = '120, 160, 255';
  const baseGlowOpacity = 0.15;
  const idleOpacity = baseGlowOpacity * 0.2;
  const hoverOpacity = baseGlowOpacity * 1.6;
  const dragOpacity = baseGlowOpacity * 2.2;
  const dropZoneGlowOpacity = isDragging
    ? dragOpacity
    : isTokenHovered
      ? hoverOpacity
      : idleOpacity;
  const glowSpread = isDragging ? 2.2 : isTokenHovered ? 1.6 : 1;

  return (
    <div
      data-tappalka-post-id={post.id}
      className={cn(
        'relative flex flex-col bg-base-100 rounded-xl shadow-lg overflow-hidden transition-all duration-300',
        'border-2',
        // Mobile (post carousel only): cap card height at 1/3 viewport so two cards fit on screen
        'max-md:max-h-[33.33vh] max-md:min-h-0',
        isSelected
          ? 'border-green-500 shadow-green-500/20'
          : isDropTarget
            ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 shadow-blue-400/20'
            : 'border-base-300 dark:border-base-700',
        (onDrop || onPostClick) && !disabled && 'cursor-pointer',
        disabled && 'opacity-75 cursor-not-allowed',
      )}
      style={{
        // Drop zone glow - outer outline, no layout change
        boxShadow: !isSelected && !isDropTarget
          ? `0 0 0 ${1 * glowSpread}px rgba(${accentRgb}, ${dropZoneGlowOpacity}), 0 6px 18px rgba(0,0,0,0.45)`
          : undefined,
        // 1px accent border when dragging (no layout change)
        outline: isDragging && !isSelected && !isDropTarget
          ? `1px solid rgba(${accentRgb}, 0.35)`
          : 'none',
        outlineOffset: -1,
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onClick={handleCardClick}
    >
      {/* Image: scaled-down preview on mobile (aspect ratio preserved, lightbox on tap); full strip on desktop */}
      {post.imageUrl && (
        <div
          className={cn(
            'w-full overflow-hidden bg-base-200 shrink-0 flex items-center justify-center',
            isMobileCarousel ? 'min-h-[4rem]' : 'h-48',
          )}
        >
          <ImageGalleryDisplay
            variant="carousel"
            images={[post.imageUrl]}
            altPrefix={post.title ? `${post.title} - Image` : 'Post image'}
            maxPreviewHeight={isMobileCarousel ? 64 : undefined}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col flex-1 min-h-0 p-4 gap-2 md:gap-3 overflow-hidden">
        {/* Title */}
        {post.title && (
          titleIsHtml ? (
            <div
              className="text-base md:text-lg font-semibold text-base-content line-clamp-1 md:line-clamp-2 prose prose-sm dark:prose-invert max-w-none [&>*]:!my-0 [&>p]:!mb-0 min-w-0"
              dangerouslySetInnerHTML={{ __html: sanitizedTitle }}
            />
          ) : (
            <h3 className="text-base md:text-lg font-semibold text-base-content line-clamp-1 md:line-clamp-2 min-w-0">
              {post.title}
            </h3>
          )
        )}

        {/* Description */}
        {post.description && (
          descriptionIsHtml ? (
            <div
              className="text-xs md:text-sm text-base-content/70 line-clamp-2 md:line-clamp-3 flex-1 min-h-0 prose prose-sm dark:prose-invert max-w-none [&>*]:!my-0 [&>p]:!mb-0 min-w-0"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          ) : (
            <p className="text-xs md:text-sm text-base-content/70 line-clamp-2 md:line-clamp-3 flex-1 min-w-0">
              {post.description}
            </p>
          )
        )}

        {/* Author */}
        <div className="flex items-center gap-2 pt-1 md:pt-2 border-t border-base-300 dark:border-base-700 shrink-0">
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

