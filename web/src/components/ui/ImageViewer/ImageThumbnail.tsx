'use client';

import React, { useState } from 'react';
import { ImageViewer } from './ImageViewer';

export interface ImageThumbnailProps {
  /** Image URL */
  src: string;
  /** Alt text */
  alt?: string;
  /** Aspect ratio (default: 16/9) */
  aspectRatio?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Whether to show rounded corners */
  rounded?: boolean;
  /** Additional class name */
  className?: string;
  /** Object fit mode */
  objectFit?: 'cover' | 'contain';
  /** Whether clicking opens lightbox viewer (default: true). Set to false in list views. */
  enableViewer?: boolean;
}

export function ImageThumbnail({
  src,
  alt = 'Image',
  aspectRatio = 16 / 9,
  maxHeight = 300,
  rounded = true,
  className = '',
  objectFit = 'cover',
  enableViewer = true,
}: ImageThumbnailProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (enableViewer) {
      e.stopPropagation(); // Prevent card navigation when clicking image
      setIsViewerOpen(true);
    }
    // If enableViewer is false, click will propagate to parent (card navigation)
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div
        className={`
          bg-base-200 flex items-center justify-center text-base-content/40
          ${rounded ? 'rounded-xl' : ''}
          ${className}
        `}
        style={{
          aspectRatio: String(aspectRatio),
          maxHeight,
        }}
      >
        <span className="text-sm">Failed to load image</span>
      </div>
    );
  }

  return (
    <>
      <div
        className={`
          relative overflow-hidden cursor-pointer group
          ${rounded ? 'rounded-xl' : ''}
          ${className}
        `}
        style={{
          aspectRatio: String(aspectRatio),
          maxHeight,
        }}
        onClick={handleClick}
      >
        {/* Loading skeleton */}
        {isLoading && (
          <div className="absolute inset-0 bg-base-200 animate-pulse" />
        )}

        {/* Image */}
        <img
          src={src}
          alt={alt}
          className={`
            w-full h-full transition-transform duration-200
            ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}
            group-hover:scale-105
          `}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
      </div>

      {/* Lightbox viewer - only render if enabled */}
      {enableViewer && (
        <ImageViewer
          src={src}
          alt={alt}
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </>
  );
}

export default ImageThumbnail;

