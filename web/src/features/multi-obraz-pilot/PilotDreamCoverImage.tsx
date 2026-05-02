'use client';

import { cn } from '@/lib/utils';

export interface PilotDreamCoverImageProps {
  src: string;
  alt?: string;
  /** Outer frame: full width, centers narrow images; use for letterbox background (e.g. bg-[#1e293b]). */
  className?: string;
  classNameImage?: string;
}

/**
 * Dream cover: full image visible, scale to container width, height from aspect ratio.
 * Narrower-than-container images stay intrinsic width and are centered (side margins).
 */
export function PilotDreamCoverImage({
  src,
  alt = '',
  className,
  classNameImage,
}: PilotDreamCoverImageProps) {
  return (
    <div className={cn('flex w-full justify-center', className)}>
      <img
        src={src}
        alt={alt}
        className={cn('block h-auto w-auto max-w-full', classNameImage)}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
