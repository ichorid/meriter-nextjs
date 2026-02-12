'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TappalkaMeritIconProps {
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onHoverChange?: (isHovered: boolean) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  isTokenHovered?: boolean; // For drop zone highlighting
  isDragging?: boolean; // External drag state
}

export const TappalkaMeritIcon: React.FC<TappalkaMeritIconProps> = ({
  onDragStart,
  onDragEnd,
  onHoverChange,
  className,
  size = 'md',
  disabled = false,
  isTokenHovered = false,
  isDragging: externalDragging = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [hasDraggedOnce, setHasDraggedOnce] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInteractedRef = useRef(false);

  // Track if user has dragged once (disable pulse after first drag)
  useEffect(() => {
    if (isDragging && !hasDraggedOnce) {
      setHasDraggedOnce(true);
      // Store in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('tappalka_has_dragged', 'true');
      }
    }
  }, [isDragging, hasDraggedOnce]);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasDragged = localStorage.getItem('tappalka_has_dragged') === 'true';
      if (hasDragged) {
        setHasDraggedOnce(true);
      }
    }
  }, []);

  // Tooltip show/hide logic
  useEffect(() => {
    if (isHovered && !isDragging && !disabled && !hasDraggedOnce) {
      tooltipTimeoutRef.current = setTimeout(() => {
        setShowTooltip(true);
      }, 400);
    } else {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      setShowTooltip(false);
    }
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, [isHovered, isDragging, disabled, hasDraggedOnce]);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      setIsDragging(true);
      setIsActive(false);
      setShowTooltip(false);
      hasInteractedRef.current = true;
      
      // Set drag image (optional - can customize the drag preview)
      const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
      dragImage.style.opacity = '0.9';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      
      // Set drag data
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'merit');
      
      // Call custom handler
      onDragStart?.();
      
      // Clean up drag image after a short delay
      setTimeout(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage);
        }
      }, 0);
    },
    [onDragStart, disabled],
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      setIsDragging(false);
      setIsActive(false);
      onDragEnd?.();
    },
    [onDragEnd],
  );

  const handleMouseDown = useCallback(() => {
    if (!disabled) {
      setIsActive(true);
      hasInteractedRef.current = true;
    }
  }, [disabled]);

  const handleMouseUp = useCallback(() => {
    setIsActive(false);
  }, []);

  // Combine internal and external dragging state
  const isActuallyDragging = isDragging || externalDragging;

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16', // 64px
    lg: 'w-20 h-20',
  };

  // Hitbox is larger than visual size (80px minimum)
  const hitboxSize = size === 'lg' ? 'w-20 h-20' : size === 'md' ? 'w-20 h-20' : 'w-16 h-16';

  return (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseEnter={() => {
        if (!disabled) {
          setIsHovered(true);
          onHoverChange?.(true);
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsActive(false);
        onHoverChange?.(false);
      }}
      className={cn(
        'relative transition-all duration-[120ms] ease-out',
        !disabled && 'cursor-grab active:cursor-grabbing',
        disabled && 'cursor-not-allowed opacity-50',
        // Scale states
        isActuallyDragging && 'scale-[1.08] z-50',
        isActive && !isActuallyDragging && 'scale-[0.97]',
        isHovered && !isActuallyDragging && !isActive && 'scale-[1.04]',
        // Idle pulse animation (disabled after first drag or on hover/active)
        !hasDraggedOnce && !isHovered && !isActive && !isActuallyDragging && !disabled && 'animate-pulse-scale',
        // Hitbox
        hitboxSize,
        'flex items-center justify-center',
        className,
      )}
      role="button"
      aria-label={disabled ? 'Голосование уже сделано' : 'Зажмите и перетащите знак на выбранный пост'}
      tabIndex={disabled ? -1 : 0}
    >
      {/* Visual container - rounded square 64x64px with 16px radius */}
      <div
        className={cn(
          'absolute inset-0 rounded-2xl', // 16px radius
          'bg-gradient-to-b from-[#1C2430] to-[#131A22]',
          'border border-white/8',
          'transition-all duration-[120ms] ease-out',
          // Shadow states
          !isActuallyDragging && 'shadow-[0_6px_18px_rgba(0,0,0,0.45)]',
          isActuallyDragging && 'shadow-[0_0_27px_rgba(230,184,92,0.42)]', // Enhanced glow when dragging
          isHovered && !isActuallyDragging && 'shadow-[0_0_0_1px_rgba(120,160,255,0.25),0_8px_22px_rgba(0,0,0,0.55)]',
          // Background brightness on hover and drag
          isHovered && !isActuallyDragging && 'brightness-[1.08]',
          isActuallyDragging && 'brightness-110',
        )}
        style={{
          width: '64px',
          height: '64px',
          // Subtle noise texture (simulated with multiple gradients)
          backgroundImage: `
            linear-gradient(180deg, #1C2430 0%, #131A22 100%),
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.02) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(255,255,255,0.01) 0%, transparent 50%)
          `,
        }}
      />

      {/* Merit icon - gold/amber color with soft glow */}
      <div className="relative z-10 w-10 h-10 flex items-center justify-center">
        <img
          src="/meriter/merit.svg"
          alt="Мерит"
          className={cn(
            'w-full h-full object-contain select-none transition-all duration-180',
            // Gold/amber color filter
            'brightness-0 saturate-100',
            // Glow effect - enhanced when dragging
            isActuallyDragging ? 'drop-shadow-[0_0_13.5px_rgba(230,184,92,0.5625)]' : 'drop-shadow-[0_0_6px_rgba(230,184,92,0.25)]',
          )}
          style={{
            filter: 'brightness(0) saturate(100%) invert(78%) sepia(30%) saturate(1234%) hue-rotate(3deg) brightness(95%) contrast(92%)',
          }}
          draggable={false}
        />
      </div>

      {/* Connection indicator to VS zone - subtle dotted line up */}
      {!isActuallyDragging && (
        <div
          className={cn(
            'absolute -top-8 left-1/2 -translate-x-1/2 w-px h-6',
            'bg-gradient-to-t from-white/15 to-transparent',
            'opacity-0 transition-opacity duration-200',
            isHovered && 'opacity-100',
          )}
          style={{
            backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)',
          }}
        />
      )}

      {/* Soft radial spotlight under token - visual connection to VS zone */}
      <div
        className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full',
          'pointer-events-none',
        )}
        style={{
          width: '120px',
          height: '120px',
          background: 'radial-gradient(circle, rgba(120, 160, 255, 0.08) 0%, rgba(120, 160, 255, 0.04) 50%, transparent 100%)',
        }}
      />

      {/* Tooltip */}
      {showTooltip && (
        <div
          className={cn(
            'absolute -top-12 left-1/2 -translate-x-1/2',
            'px-3 py-1.5 rounded-lg',
            'bg-base-300 dark:bg-base-700 text-sm text-base-content',
            'shadow-lg border border-base-content/10',
            'animate-in fade-in duration-120',
            'whitespace-nowrap',
            'pointer-events-none z-50',
          )}
        >
          Зажмите и перетащите
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-base-300 dark:border-t-base-700" />
        </div>
      )}
    </div>
  );
};

