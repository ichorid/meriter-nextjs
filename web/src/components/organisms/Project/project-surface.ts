import { cn } from '@/lib/utils';

/** Theme-aware project panels — aligned with community hub cards (BUG-012). */
export const projectPanelSurfaceClass = cn(
  'rounded-xl border border-base-300/50 bg-base-100/80 shadow-sm',
  'dark:border-stitch-border/40 dark:bg-stitch-surface/90',
);

export const projectPanelInsetClass = cn(
  'rounded-xl border border-base-300/40 bg-base-200/40',
  'dark:border-stitch-border/30 dark:bg-stitch-surface2/60',
);

export const projectDividerClass = 'border-base-300/50 dark:border-stitch-border/40';

export const projectSoftHoverClass =
  'hover:bg-base-200/60 dark:hover:bg-stitch-surface2/80';

export const projectEmptyStateClass = cn(
  'rounded-xl border border-dashed border-base-300/60 bg-base-200/30 px-6 py-12 text-center',
  'dark:border-stitch-border/50 dark:bg-stitch-surface2/30',
);

export const projectAvatarBorderClass =
  'border border-base-300/50 dark:border-stitch-border/40';

export const projectMutedBadgeClass = cn(
  'border-base-300/50 bg-base-200/60',
  'dark:border-white/10 dark:bg-white/10',
);

export const projectTrackBgClass = 'bg-base-300/50 dark:bg-white/10';

/** Hub feed cards (projects list, future visions) — theme tokens instead of hardcoded hex. */
export const hubFeedCardClass = cn(
  'rounded-xl overflow-hidden border border-base-300/50 bg-base-100 p-5 shadow-none',
  'dark:border-stitch-border/40 dark:bg-stitch-surface/90',
  'hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300',
);
