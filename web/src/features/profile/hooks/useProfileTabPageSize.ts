'use client';

import { useMediaQuery } from '@/hooks/useMediaQuery';

/** Responsive page size for profile feed tabs (matches useProfileData). */
export function useProfileTabPageSize(): number {
  const isMobile = useMediaQuery('(max-width: 640px)');
  return isMobile ? 10 : 20;
}
