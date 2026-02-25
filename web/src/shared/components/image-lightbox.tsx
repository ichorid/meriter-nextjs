'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface ImageLightboxProps {
  /** Array of image URLs */
  images: string[];
  /** Alt text prefix */
  altPrefix?: string;
  /** Initial viewing index */
  initialIndex?: number;
  /** Whether the lightbox is open */
  isOpen: boolean;
  /** Callback when lightbox closes */
  onClose: () => void;
}

/**
 * ImageLightbox - Full-screen lightbox viewer for multiple images
 * Supports keyboard navigation and image counter
 */
export function ImageLightbox({
  images,
  altPrefix = 'Image',
  initialIndex = 0,
  isOpen,
  onClose,
}: ImageLightboxProps) {
  const tAria = useTranslations('common.ariaLabels');
  const [viewingIndex, setViewingIndex] = useState<number>(initialIndex || 0);

  // Sync with initialIndex prop changes
  useEffect(() => {
    if (initialIndex !== undefined && initialIndex >= 0 && initialIndex < images.length) {
      setViewingIndex(initialIndex);
    }
  }, [initialIndex, images.length]);

  // Reset to initial index when opening
  useEffect(() => {
    if (isOpen && initialIndex !== undefined) {
      setViewingIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const handleNext = useCallback(() => {
    setViewingIndex(prev => {
      return prev < images.length - 1 ? prev + 1 : 0;
    });
  }, [images.length]);

  const handlePrev = useCallback(() => {
    setViewingIndex(prev => {
      return prev > 0 ? prev - 1 : images.length - 1;
    });
  }, [images.length]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !images || images.length === 0 || viewingIndex < 0 || viewingIndex >= images.length) {
    return null;
  }

  // Render in portal to ensure it's above everything
  const lightboxContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 z-10 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        aria-label={tAria('close')}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Previous button */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="absolute left-4 z-10 p-3 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-sm"
          aria-label={tAria('previousImage')}
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Image container */}
      <div 
        className="flex items-center justify-center max-w-full max-h-full p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {images[viewingIndex] && (
          <img
            src={images[viewingIndex]}
            alt={`${altPrefix} ${viewingIndex + 1} of ${images.length}`}
            className="max-w-full max-h-[90vh] object-contain"
            key={viewingIndex}
          />
        )}
      </div>

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute right-4 z-10 p-3 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-sm"
          aria-label={tAria('nextImage')}
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Image counter */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-sm text-white text-sm rounded-full font-medium">
          {viewingIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );

  // Render in portal to avoid overflow issues
  if (typeof window === 'undefined') {
    return null;
  }

  return createPortal(lightboxContent, document.body);
}

