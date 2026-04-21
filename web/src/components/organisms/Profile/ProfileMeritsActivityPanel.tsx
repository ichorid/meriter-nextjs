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
        // One soft surface — no extra frame (matches profile lists below)
        'rounded-md sm:rounded-lg',
        className,
      )}
    >
      {showMerits ? (
        <>
          <div className="px-1 pb-1.5 pt-1 sm:px-0 sm:pb-2 sm:pt-1.5">{meritsSlot}</div>
          <div
            className="h-px w-full bg-base-content/[0.06] dark:bg-base-content/[0.08]"
            role="presentation"
            aria-hidden
          />
        </>
      ) : null}
      <div
        className={cn(
          'px-1 py-2 sm:px-0 sm:py-2.5',
          !showMerits && 'pt-2.5 sm:pt-3',
          showMerits && 'pt-1.5 sm:pt-2',
        )}
      >
        {activitySlot}
      </div>
    </div>
  );
}
