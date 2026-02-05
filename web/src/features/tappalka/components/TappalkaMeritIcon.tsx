'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/shared/lib/theme-provider';

interface TappalkaMeritIconProps {
  onDragStart?: () => void;
  onDragEnd?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const TappalkaMeritIcon: React.FC<TappalkaMeritIconProps> = ({
  onDragStart,
  onDragEnd,
  className,
  size = 'md',
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const { resolvedTheme } = useTheme();

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      setIsDragging(true);
      
      // Set drag image (optional - can customize the drag preview)
      const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
      dragImage.style.opacity = '0.8';
      dragImage.style.transform = 'rotate(15deg)';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      
      // Set drag data
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'merit');
      
      // Call custom handler
      onDragStart?.();
      
      // Clean up drag image after a short delay
      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 0);
    },
    [onDragStart, disabled],
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      setIsDragging(false);
      onDragEnd?.();
    },
    [onDragEnd],
  );

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
  };

  return (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'relative transition-all duration-200',
        !disabled && 'cursor-grab active:cursor-grabbing hover:scale-110 hover:rotate-12',
        disabled && 'cursor-not-allowed opacity-50',
        isDragging && 'opacity-50 scale-90 rotate-12',
        sizeClasses[size],
        className,
      )}
      role="button"
      aria-label={disabled ? 'Голосование уже сделано' : 'Перетащите мерит на пост'}
      tabIndex={disabled ? -1 : 0}
    >
      {/* Merit icon - using SVG from public */}
      <div className="relative w-full h-full">
        <img
          src="/meriter/merit.svg"
          alt="Мерит"
          className={cn(
            'w-full h-full object-contain transition-all duration-200 select-none',
            // Invert colors in dark mode to make dark icon visible on dark background
            resolvedTheme === 'dark' && 'invert brightness-110',
            // Reduce brightness when dragging (works in both themes)
            isDragging && (resolvedTheme === 'dark' ? 'brightness-90' : 'brightness-75'),
          )}
          draggable={false}
        />
      </div>
      
      {/* Glow effect when dragging */}
      {isDragging && (
        <div className="absolute inset-0 rounded-full bg-yellow-400/30 blur-md -z-10 animate-pulse" />
      )}
      
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-full bg-yellow-400/0 hover:bg-yellow-400/20 blur-md -z-10 transition-all duration-200" />
    </div>
  );
};

