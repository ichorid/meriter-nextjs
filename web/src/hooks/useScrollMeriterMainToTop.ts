'use client';

import { useLayoutEffect } from 'react';

function scrollMeriterMainToTop(): void {
  const mainWrap = document.querySelector('.mainWrap') as HTMLElement | null;
  if (mainWrap) {
    mainWrap.scrollTop = 0;
    mainWrap.scrollLeft = 0;
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/**
 * Meriter shell uses `.mainWrap` as the scroll container. Client navigations can
 * keep the previous scroll position; call on create/edit form pages so the header
 * stays visible.
 */
export function useScrollMeriterMainToTop(): void {
  useLayoutEffect(() => {
    scrollMeriterMainToTop();
    let cancelled = false;
    const id1 = requestAnimationFrame(() => {
      if (cancelled) return;
      scrollMeriterMainToTop();
      requestAnimationFrame(() => {
        if (!cancelled) scrollMeriterMainToTop();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id1);
    };
  }, []);
}
