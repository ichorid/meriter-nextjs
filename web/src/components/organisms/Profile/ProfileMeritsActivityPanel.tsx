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
        'overflow-hidden rounded-2xl border border-base-300/50 bg-base-100 shadow-sm',
        'ring-1 ring-black/[0.04] dark:ring-white/[0.06]',
        className,
      )}
    >
      {showMerits ? (
        <>
          <div className="px-3 pb-2 pt-2.5 sm:px-4 sm:pb-2.5 sm:pt-3">{meritsSlot}</div>
          <div
            className="mx-3 h-px shrink-0 bg-base-300/55 sm:mx-4"
            role="presentation"
            aria-hidden
          />
        </>
      ) : null}
      <div
        className={cn(
          'px-3 py-2.5 sm:px-4 sm:py-3',
          !showMerits && 'pt-3 sm:pt-4',
          showMerits && 'pt-2 sm:pt-2.5',
        )}
      >
        {activitySlot}
      </div>
    </div>
  );
}
