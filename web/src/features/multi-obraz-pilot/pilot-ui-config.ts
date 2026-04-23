/**
 * Central pilot UI flags (FR-17). Import from here instead of scattering env checks.
 */
import { isPilotClientMode, isPilotDreamProject } from '@/config/pilot';
import type { Community } from '@meriter/shared-types';

export function getPilotUiConfig(project: Community | null | undefined): {
  pilotRuntime: boolean;
  isPilotDream: boolean;
  showFullMeriterProjectChrome: boolean;
} {
  const pilotRuntime = isPilotClientMode();
  const isPilotDream = project ? isPilotDreamProject(project) : false;
  return {
    pilotRuntime,
    isPilotDream,
    showFullMeriterProjectChrome: !(pilotRuntime && isPilotDream),
  };
}
