'use client';

import React, { useRef, useCallback, useEffect } from 'react';

export interface ResizeHandleProps {
  /** Callback when resize starts */
  onResizeStart?: () => void;
  /** Callback when resize ends */
  onResizeEnd?: () => void;
  /** Callback during resize with new width */
  onResize: (width: number) => void;
  /** Initial width */
  initialWidth: number;
  /** Minimum width */
  minWidth: number;
  /** Maximum width */
  maxWidth: number;
  /** Direction of resize: 'left' (resize from left edge) or 'right' (resize from right edge) */
  direction?: 'left' | 'right';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Resize handle component for resizing panels
 * Supports dragging to resize horizontally
 */
export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  onResizeStart,
  onResizeEnd,
  onResize,
  initialWidth,
  minWidth,
  maxWidth,
  direction = 'left',
  className = '',
}) => {
  const handleRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(initialWidth);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = initialWidth;
    
    onResizeStart?.();
    
    // Add global mouse event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, [initialWidth, onResizeStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = direction === 'left' 
      ? startXRef.current - e.clientX  // Left edge: dragging left increases width
      : e.clientX - startXRef.current;  // Right edge: dragging right increases width
    
    const newWidth = Math.max(
      minWidth,
      Math.min(maxWidth, startWidthRef.current + deltaX)
    );

    onResize(newWidth);
  }, [direction, minWidth, maxWidth, onResize]);

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    
    isDraggingRef.current = false;
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Restore text selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    onResizeEnd?.();
  }, [handleMouseMove, onResizeEnd]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={handleRef}
      className={`resize-handle ${className}`}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        top: 0,
        [direction === 'left' ? 'left' : 'right']: 0,
        width: '4px',
        height: '100%',
        cursor: 'col-resize',
        backgroundColor: 'transparent',
        zIndex: 10,
        userSelect: 'none',
      }}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
    />
  );
};

