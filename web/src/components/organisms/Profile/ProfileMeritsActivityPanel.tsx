'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  activitySlot: ReactNode;
  className?: string;
};

/** Profile card: activity stats (merits summary lives in ProfileHero). */
export function ProfileMeritsActivityPanel({ activitySlot, className }: Props) {
  return (
    <div className={cn('bg-base-100', className)}>
      <div className="px-0 py-4">{activitySlot}</div>
    </div>
  );
}
