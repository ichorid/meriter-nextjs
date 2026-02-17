"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";

export type ImageGalleryVariant = "feed" | "page" | "carousel";

export interface ImageGalleryDisplayProps {
    /** Array of image URLs */
    images: string[];
    /** Alt text prefix */
    altPrefix?: string;
    /** Context: feed (compact), page (full), carousel (single/strip) */
    variant?: ImageGalleryVariant;
    /** Maximum columns for grid layout (legacy, variant overrides when set) */
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
 * ImageGalleryDisplay - Displays images with lightbox.
 * - Feed: single preview image + gallery badge (like Twitter/Facebook), click opens lightbox.
 * - Page: 2×2 thumbnails with "+N" overflow; full gallery in lightbox.
 * - Carousel: single image strip.
 */
const VARIANT_STYLES = {
    feed: { rounded: "rounded-lg", previewMaxH: "max-h-[220px] sm:max-h-[280px]" },
    page: { gap: "gap-1.5", rounded: "rounded-xl", maxH: "max-h-[180px] sm:max-h-[220px]", minH: "min-h-[100px] sm:min-h-[120px]" },
    carousel: { gap: "gap-1", rounded: "rounded-lg", maxH: "max-h-[192px]", minH: "min-h-[120px]" },
} as const;

const PAGE_GRID_MAX = 4;

export function ImageGalleryDisplay({
    images,
    altPrefix = "Image",
    variant = "page",
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
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);

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

    const styles = VARIANT_STYLES[variant];

    // Grid: page = 2×2 (or 1 col if single image), carousel = 1 col
    const getGridClass = () => {
        if (variant === "carousel" || displayImages.length === 1) return "grid-cols-1";
        return "grid-cols-2";
    };

    const displayImages = variant === "page" ? images.slice(0, PAGE_GRID_MAX) : images;
    const overflowCount = variant === "page" && images.length > PAGE_GRID_MAX ? images.length - PAGE_GRID_MAX : 0;

    // If viewingIndex is set (either from initialIndex or user click), show lightbox
    // If initialIndex was provided, don't show preview grid
    const showOnlyLightbox =
        initialIndex !== null && initialIndex !== undefined;

    const lightboxSwipeHandlers = {
        onTouchStart: (e: React.TouchEvent) => {
            touchStartX.current = e.targetTouches[0].clientX;
            touchEndX.current = null;
        },
        onTouchMove: (e: React.TouchEvent) => {
            touchEndX.current = e.targetTouches[0].clientX;
        },
        onTouchEnd: () => {
            if (touchStartX.current == null || touchEndX.current == null || images.length <= 1) return;
            const diff = touchStartX.current - touchEndX.current;
            const threshold = 50;
            if (diff > threshold) handleNext();
            else if (diff < -threshold) handlePrev();
            touchStartX.current = null;
            touchEndX.current = null;
        },
    };

    const lightboxOverlayClass =
        "fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]";

    const renderLightbox = () => (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Image gallery"
            className={lightboxOverlayClass}
            onClick={handleClose}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            {...lightboxSwipeHandlers}
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                }}
                className="absolute top-4 right-4 z-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors"
                aria-label="Close"
            >
                <X className="w-6 h-6" strokeWidth={2} />
            </button>
            {images.length > 1 && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handlePrev();
                    }}
                    className="absolute left-2 sm:left-4 z-[100] min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors backdrop-blur-sm"
                    aria-label="Previous image"
                >
                    <ChevronLeft size={28} />
                </button>
            )}
            <div
                className="flex items-center justify-center max-w-full max-h-[85vh] sm:max-h-[90vh] p-4"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={images[viewingIndex!]}
                    alt={`${altPrefix} ${viewingIndex! + 1} of ${images.length}`}
                    className="max-w-full max-h-full object-contain"
                />
            </div>
            {images.length > 1 && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleNext();
                    }}
                    className="absolute right-2 sm:right-4 z-[100] min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors backdrop-blur-sm"
                    aria-label="Next image"
                >
                    <ChevronRight size={28} />
                </button>
            )}
            {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-sm text-white text-sm rounded-full font-medium">
                    {viewingIndex! + 1} / {images.length}
                </div>
            )}
        </div>
    );

    if (
        showOnlyLightbox &&
        viewingIndex !== null &&
        viewingIndex >= 0 &&
        viewingIndex < images.length
    ) {
        return typeof window !== "undefined"
            ? createPortal(renderLightbox(), document.body)
            : null;
    }

    const lightboxPortal =
        !onImageClick &&
        typeof window !== "undefined" &&
        viewingIndex !== null &&
        images[viewingIndex]
            ? createPortal(renderLightbox(), document.body)
            : null;

    // Feed: single preview image + gallery badge (no full grid)
    if (variant === "feed") {
        const feedStyles = VARIANT_STYLES.feed;
        return (
            <>
                <div
                    className={`relative w-full overflow-hidden cursor-pointer group bg-base-200 ${feedStyles.rounded} ${feedStyles.previewMaxH} ${className}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleImageClick(0);
                    }}
                >
                    {!imageLoadStates[0] && (
                        <div className={`absolute inset-0 bg-base-200 animate-pulse ${feedStyles.rounded}`} />
                    )}
                    <img
                        src={images[0]}
                        alt={images.length > 1 ? `${altPrefix} 1 of ${images.length}` : `${altPrefix} 1`}
                        className={`w-full h-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02] ${imageLoadStates[0] ? "opacity-100" : "opacity-0"}`}
                        onLoad={() => handleImageLoad(0)}
                        loading="lazy"
                    />
                    {images.length > 1 && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/65 backdrop-blur-sm text-white text-xs font-medium rounded-lg shadow-sm">
                            <Images className="w-4 h-4 flex-shrink-0" aria-hidden />
                            <span>1 / {images.length}</span>
                        </div>
                    )}
                </div>
                {lightboxPortal}
            </>
        );
    }

    // Page / carousel: grid of thumbnails (page = 2×2 max with "+N", carousel = single)
    return (
        <>
            <div
                className={`grid ${getGridClass()} ${styles.gap} ${styles.rounded} ${className}`}
            >
                {displayImages.map((imageUrl, index) => (
                    <div
                        key={index}
                        className={`
              relative overflow-hidden cursor-pointer group
              bg-base-200 aspect-square
              ${styles.rounded} ${variant === "page" || variant === "carousel" ? `${styles.maxH} ${styles.minH}` : ""}
              shadow-sm hover:shadow-md border border-base-300/50 hover:border-base-content/20
              transition-all duration-200 ease-out
            `}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleImageClick(index);
                        }}
                    >
                        {!imageLoadStates[index] && (
                            <div className={`absolute inset-0 bg-base-200 animate-pulse ${styles.rounded}`} />
                        )}

                        <img
                            src={imageUrl}
                            alt={`${altPrefix} ${index + 1}`}
                            className={`
                                absolute inset-0 m-0 w-full h-full object-cover transition-transform duration-200 ease-out
                                group-hover:scale-[1.03]
                                ${imageLoadStates[index] ? "opacity-100" : "opacity-0"}
                            `}
                            onLoad={() => handleImageLoad(index)}
                            loading="lazy"
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

                        {variant === "page" && index === PAGE_GRID_MAX - 1 && overflowCount > 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
                                <span className="text-white text-lg sm:text-xl font-semibold">+{overflowCount}</span>
                            </div>
                        ) : images.length > 1 && !(variant === "page" && index === PAGE_GRID_MAX - 1 && overflowCount > 0) ? (
                            <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[10px] sm:text-xs font-medium rounded-md">
                                {index + 1}/{images.length}
                            </div>
                        ) : null}
                    </div>
                ))}
            </div>
            {lightboxPortal}
        </>
    );
}
