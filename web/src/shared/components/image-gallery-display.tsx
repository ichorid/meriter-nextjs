"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ImageGalleryDisplayProps {
    /** Array of image URLs */
    images: string[];
    /** Alt text prefix */
    altPrefix?: string;
    /** Maximum columns for grid layout */
    maxColumns?: number;
    /** Custom class name */
    className?: string;
    /** Initial viewing index (if set, lightbox opens immediately) */
    initialIndex?: number | null;
    /** Callback when lightbox closes */
    onClose?: () => void;
    /** Callback when image is clicked (if provided, overrides internal lightbox) */
    onImageClick?: (index: number) => void;
}

/**
 * ImageGalleryDisplay - Displays images in a grid with lightbox viewer
 * Similar to Telegram/Slack image galleries
 */
export function ImageGalleryDisplay({
    images,
    altPrefix = "Image",
    maxColumns = 3,
    className = "",
    initialIndex = null,
    onClose,
    onImageClick,
}: ImageGalleryDisplayProps) {
    const [viewingIndex, setViewingIndex] = useState<number | null>(
        initialIndex ?? null
    );
    const [imageLoadStates, setImageLoadStates] = useState<
        Record<number, boolean>
    >({});

    // Sync with initialIndex prop changes - if initialIndex is set, open lightbox
    useEffect(() => {
        if (
            initialIndex !== null &&
            initialIndex !== undefined &&
            initialIndex >= 0
        ) {
            setViewingIndex(initialIndex);
        } else if (initialIndex === null) {
            // Only clear if explicitly set to null
            setViewingIndex(null);
        }
    }, [initialIndex]);

    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    const handleNext = useCallback(() => {
        setViewingIndex((prev) => {
            if (prev === null) return null;
            return prev < images.length - 1 ? prev + 1 : 0;
        });
    }, [images.length]);

    const handlePrev = useCallback(() => {
        setViewingIndex((prev) => {
            if (prev === null) return null;
            return prev > 0 ? prev - 1 : images.length - 1;
        });
    }, [images.length]);

    // Handle keyboard navigation
    useEffect(() => {
        if (viewingIndex === null) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setViewingIndex(null);
            } else if (e.key === "ArrowRight") {
                setViewingIndex((prev) =>
                    prev !== null && prev < images.length - 1
                        ? prev + 1
                        : prev !== null
                        ? 0
                        : null
                );
            } else if (e.key === "ArrowLeft") {
                setViewingIndex((prev) =>
                    prev !== null && prev > 0
                        ? prev - 1
                        : prev !== null
                        ? images.length - 1
                        : null
                );
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [viewingIndex, images.length]);

    // Prevent body scroll when lightbox is open
    useEffect(() => {
        if (viewingIndex !== null) {
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [viewingIndex]);

    // Early return AFTER all hooks have been called
    if (!images || images.length === 0) {
        return null;
    }

    const handleImageClick = (index: number) => {
        if (onImageClick) {
            // Use external handler if provided (for external lightbox)
            onImageClick(index);
        } else {
            // Use internal lightbox
            setViewingIndex(index);
        }
    };

    const handleClose = () => {
        setViewingIndex(null);
        onClose?.();
    };

    const handleImageLoad = (index: number) => {
        setImageLoadStates((prev) => ({ ...prev, [index]: true }));
    };

    // Determine grid layout based on number of images (Telegram/Slack style)
    const getGridClass = () => {
        if (images.length === 1) return "grid-cols-1";
        if (images.length === 2) return "grid-cols-2";
        if (images.length === 3) return "grid-cols-3";
        if (images.length === 4) return "grid-cols-2";
        if (images.length <= 6) return "grid-cols-3";
        return "grid-cols-3";
    };

    const getImageAspect = (index: number) => {
        // All images should be thumbnails (smaller size) - they open in lightbox
        // Use square aspect for consistency, but with max height limit
        return "aspect-square";
    };

    // If viewingIndex is set (either from initialIndex or user click), show lightbox
    // If initialIndex was provided, don't show preview grid
    const showOnlyLightbox =
        initialIndex !== null && initialIndex !== undefined;

    // Show only lightbox mode (no preview grid) when initialIndex is provided
    if (
        showOnlyLightbox &&
        viewingIndex !== null &&
        viewingIndex >= 0 &&
        viewingIndex < images.length
    ) {
        return typeof window !== "undefined"
            ? createPortal(
                  <div
                      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
                      onClick={handleClose}
                  >
                      {/* Close button */}
                      <button
                          onClick={(e) => {
                              e.stopPropagation();
                              handleClose();
                          }}
                          className="absolute top-4 right-4 z-10 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                          aria-label="Close"
                      >
                          <svg
                              className="w-6 h-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                          >
                              <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                              />
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
                              aria-label="Previous image"
                          >
                              <ChevronLeft size={28} />
                          </button>
                      )}

                      {/* Image container */}
                      <div
                          className="flex items-center justify-center max-w-full max-h-full p-4"
                          onClick={(e) => e.stopPropagation()}
                      >
                          <img
                              src={images[viewingIndex]}
                              alt={`${altPrefix} ${viewingIndex + 1} of ${
                                  images.length
                              }`}
                              className="max-w-full max-h-[90vh] object-contain"
                          />
                      </div>

                      {/* Next button */}
                      {images.length > 1 && (
                          <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  handleNext();
                              }}
                              className="absolute right-4 z-10 p-3 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-sm"
                              aria-label="Next image"
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
                  </div>,
                  document.body
              )
            : null;
    }

    return (
        <>
            <div className={`grid gap-3 ${getGridClass()} ${className}`}>
                {images.map((imageUrl, index) => (
                    <div
                        key={index}
                        className={`
              relative overflow-hidden rounded-xl cursor-pointer group
              bg-base-200 border border-base-content/10 dark:border-base-content/20
              shadow-sm hover:shadow-md hover:border-base-content/20 
              transition-all duration-300
              ${getImageAspect(index)}
            `}
                        style={{
                            maxHeight: "200px",
                            minHeight: "120px",
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleImageClick(index);
                        }}
                    >
                        {!imageLoadStates[index] && (
                            <div className="absolute inset-0 bg-base-200 animate-pulse rounded-xl" />
                        )}

                        <img
                            src={imageUrl}
                            alt={`${altPrefix} ${index + 1}`}
                            className={`
                                absolute inset-0 m-0 w-full h-full object-cover transition-all duration-300
                                group-hover:scale-105
                                ${
                                    imageLoadStates[index]
                                        ? "opacity-100"
                                        : "opacity-0"
                                }
                            `}
                            onLoad={() => handleImageLoad(index)}
                            loading="lazy"
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl" />

                        {images.length > 1 && (
                            <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs rounded-md font-semibold shadow-lg border border-white/10">
                                {index + 1}/{images.length}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Lightbox viewer with navigation - render in portal to avoid overflow issues (only if no external handler) */}
            {!onImageClick &&
                typeof window !== "undefined" &&
                viewingIndex !== null &&
                images[viewingIndex] &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
                        onClick={handleClose}
                    >
                        {/* Close button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClose();
                            }}
                            className="absolute top-4 right-4 z-10 p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                            aria-label="Close"
                        >
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
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
                                aria-label="Previous image"
                            >
                                <ChevronLeft size={28} />
                            </button>
                        )}

                        {/* Image container */}
                        <div
                            className="flex items-center justify-center max-w-full max-h-full p-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={images[viewingIndex]}
                                alt={`${altPrefix} ${viewingIndex + 1} of ${
                                    images.length
                                }`}
                                className="max-w-full max-h-[90vh] object-contain"
                            />
                        </div>

                        {/* Next button */}
                        {images.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleNext();
                                }}
                                className="absolute right-4 z-10 p-3 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-sm"
                                aria-label="Next image"
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
                    </div>,
                    document.body
                )}
        </>
    );
}
