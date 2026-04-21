import * as Sentry from '@sentry/nextjs';

import config from '@/config';

/**
 * Client-side UI breadcrumbs for profile and primary navigation (PRD: profile-redesign).
 * No PII in payloads — ids only where they identify entities already in URLs.
 */
export type ProfileLayoutBand = 'sm' | 'lg';

export type ActivityCardId = 'publications' | 'comments' | 'polls' | 'favorites' | 'investments';

export type ProfileActivityScope = 'self' | 'other';

export type NavPrimaryItem =
  | 'future_visions'
  | 'marathon'
  | 'projects'
  | 'notifications'
  | 'favorites'
  | 'profile'
  | 'support'
  | 'about';

export type NavSurface = 'sidebar' | 'bottom' | 'topbar';

export type MeriterUiEvent =
  | { name: 'profile_view_self'; payload: { layout: ProfileLayoutBand } }
  | { name: 'profile_view_other'; payload: { targetUserId: string; layout: ProfileLayoutBand } }
  | {
      name: 'profile_activity_card_click';
      payload: { card: ActivityCardId; scope: ProfileActivityScope };
    }
  | { name: 'profile_merit_history_open'; payload: { scope: ProfileActivityScope } }
  | { name: 'profile_share' }
  | { name: 'profile_edit_open' }
  | { name: 'profile_settings_open' }
  | { name: 'profile_invite_open' }
  | { name: 'profile_merit_transfer_open' }
  | { name: 'nav_primary_click'; payload: { item: NavPrimaryItem; surface: NavSurface } }
  | { name: 'nav_create_click'; payload: { surface: 'sidebar' | 'fab' } };

function layoutBand(): ProfileLayoutBand {
  if (typeof window === 'undefined') return 'sm';
  return window.matchMedia('(min-width: 1024px)').matches ? 'lg' : 'sm';
}

/** Exported for callers that need the same breakpoint as telemetry. */
export function getProfileLayoutBand(): ProfileLayoutBand {
  return layoutBand();
}

export function trackMeriterUiEvent(event: MeriterUiEvent): void {
  if (typeof window === 'undefined') {
    return;
  }

  const name = event.name;
  const data: Record<string, unknown> =
    'payload' in event && event.payload !== undefined
      ? (event.payload as Record<string, unknown>)
      : {};

  if (config.sentry?.enabled) {
    Sentry.addBreadcrumb({
      category: 'ui.meriter',
      message: name,
      level: 'info',
      data: { ...data },
    });
  }
}
