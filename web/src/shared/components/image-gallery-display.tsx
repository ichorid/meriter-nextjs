"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
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
    /** When set (e.g. carousel on mobile), cap preview height in px; aspect ratio preserved */
    maxPreviewHeight?: number;
}

const ASPECT_16_9 = 16 / 9;

/**
 * ImageGalleryDisplay - Single preview + lightbox.
 * - Image never scaled up; only scaled down to fit (max width = container, max height = width * 9/16).
 * - Block height = image display height → small image (e.g. 200x200) → block 200px, gray bars left/right.
 */
const VARIANT_STYLES = {
    feed: { rounded: "rounded-lg" },
    page: { rounded: "rounded-xl" },
    carousel: { rounded: "rounded-lg" },
} as const;

/** Bar color for letterboxing/pillarboxing (light and dark theme) */
const PREVIEW_BAR_BG = "bg-neutral-200 dark:bg-neutral-800";

export function ImageGalleryDisplay({
    images,
    altPrefix = "Image",
    variant = "page",
    maxColumns = 3,
    className = "",
    initialIndex = null,
    onClose,
    onImageClick,
    maxPreviewHeight,
}: ImageGalleryDisplayProps) {
    const tAria = useTranslations("common.ariaLabels");
    const [viewingIndex, setViewingIndex] = useState<number | null>(
        initialIndex ?? null
    );
    const [imageLoadStates, setImageLoadStates] = useState<
        Record<number, boolean>
    >({});
    /** First image natural size: block height = display height (never scale up) */
    const [previewNatural, setPreviewNatural] = useState<{ w: number; h: number } | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const blockRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);

    useEffect(() => {
        setPreviewNatural(null);
    }, [images[0]]);

    useEffect(() => {
        const el = blockRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const { width } = entries[0]?.contentRect ?? { width: 0 };
            setContainerWidth(width);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

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

    const handlePreviewImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        handleImageLoad(0);
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setPreviewNatural({ w: img.naturalWidth, h: img.naturalHeight });
        }
    };

    const styles = VARIANT_STYLES[variant];

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
        "fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] [pointer-events:auto]";

    const renderLightbox = () => (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={tAria("imageGallery")}
            className={lightboxOverlayClass}
            style={{ pointerEvents: "auto" }}
            onClick={(e) => {
                e.stopPropagation();
                handleClose();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            {...lightboxSwipeHandlers}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                }}
                className="absolute top-4 right-4 z-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors"
                aria-label={tAria("close")}
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
                    aria-label={tAria("previousImage")}
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
                    aria-label={tAria("nextImage")}
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

    // Never scale up; scale down only to fit width and max height (width * 9/16, or maxPreviewHeight when set)
    const displaySize =
        previewNatural && containerWidth > 0
            ? (() => {
                  const { w: nw, h: nh } = previewNatural;
                  const defaultMaxH = (containerWidth * 9) / 16;
                  const maxH =
                      maxPreviewHeight != null
                          ? Math.min(defaultMaxH, maxPreviewHeight)
                          : defaultMaxH;
                  const scale = Math.min(1, containerWidth / nw, maxH / nh);
                  return { w: Math.round(nw * scale), h: Math.round(nh * scale) };
              })()
            : null;

    return (
        <>
            <div
                ref={blockRef}
                data-gallery-preview
                className={`relative w-full overflow-hidden cursor-pointer group flex items-center justify-center ${PREVIEW_BAR_BG} ${styles.rounded} ${className}`}
                style={
                    displaySize
                        ? { height: displaySize.h }
                        : { aspectRatio: ASPECT_16_9 }
                }
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleImageClick(0);
                }}
            >
                {!imageLoadStates[0] && (
                    <div className={`absolute inset-0 ${PREVIEW_BAR_BG} animate-pulse ${styles.rounded}`} />
                )}
                <img
                    src={images[0]}
                    alt={images.length > 1 ? `${altPrefix} 1 of ${images.length}` : `${altPrefix} 1`}
                    className={`max-w-full max-h-full object-contain transition-transform duration-200 ease-out group-hover:scale-[1.02] ${imageLoadStates[0] ? "opacity-100" : "opacity-0"}`}
                    style={displaySize ? { width: displaySize.w, height: displaySize.h } : undefined}
                    onLoad={handlePreviewImageLoad}
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
