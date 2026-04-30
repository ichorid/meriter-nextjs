/**
 * Pilot UI canonical paths: home `/`, wizard `/create`, profile `/profile` when `NEXT_PUBLIC_PILOT_MODE` is on.
 * Legacy `/pilot/multi-obraz*` redirects in middleware.
 */
import { isPilotClientMode } from '@/config/pilot';
import { routes } from '@/lib/constants/routes';

export function pilotHomeHref(): string {
  if (!isPilotClientMode()) return '/meriter/profile';
  return '/';
}

export function pilotCreateHref(): string {
  if (!isPilotClientMode()) return '/meriter/projects/create';
  return '/create';
}

/** Pilot shell profile hub (not full Meriter chrome at `/meriter/profile`). */
export function pilotProfileHref(): string {
  if (!isPilotClientMode()) return routes.profile;
  return '/profile';
}

/** Pilot canonical dream route (avoids flashing full Meriter layouts). */
export function pilotDreamHref(projectId: string): string {
  if (!isPilotClientMode()) return routes.project(projectId);
  return `/dreams/${projectId}`;
}
