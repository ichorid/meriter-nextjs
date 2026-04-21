'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  /** Merits / quota block; omit when nothing to show above activity */
  meritsSlot?: ReactNode;
  activitySlot: ReactNode;
  className?: string;
};

/**
 * Single profile card: merits on top, activity stats below (own + other user).
 */
export function ProfileMeritsActivityPanel({ meritsSlot, activitySlot, className }: Props) {
  const showMerits = meritsSlot != null;

  return (
    <div
      className={cn(
        'bg-base-100',
        // Flush with ProfileHero sections (same width as contacts / about)
        className,
      )}
    >
      {showMerits ? (
        <>
          <div className="px-0 pb-1.5 pt-2 sm:pb-2 sm:pt-2.5">{meritsSlot}</div>
          <div
            className="h-px w-full bg-base-content/[0.06] dark:bg-base-content/[0.08]"
            role="presentation"
            aria-hidden
          />
        </>
      ) : null}
      <div
        className={cn(
          'px-0 py-2 sm:py-2.5',
          !showMerits && 'pt-3 sm:pt-3.5',
          showMerits && 'pt-1.5 sm:pt-2',
        )}
      >
        {activitySlot}
      </div>
    </div>
  );
}
