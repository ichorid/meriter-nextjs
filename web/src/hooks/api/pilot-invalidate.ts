import { trpc } from '@/lib/trpc/client';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';

export type TrpcUtils = ReturnType<typeof trpc.useUtils>;

/**
 * Invalidate pilot counters that are shown in the top "Merits line":
 * - Pilot quota + wallet (pilotDreams.getStats)
 * - Global wallet balance (used by some generic widgets)
 */
export function invalidatePilotMerits(utils: TrpcUtils) {
  void utils.pilotDreams.getStats.invalidate();
  void utils.wallets.getBalance.invalidate({ communityId: GLOBAL_COMMUNITY_ID });
  void utils.wallets.getAll.invalidate();
}

/** After pilot dream soft-delete / restore (superadmin). */
export function invalidatePilotDreamFeeds(utils: TrpcUtils, dreamId?: string) {
  void utils.pilotDreams.listSoftDeleted.invalidate();
  void utils.project.getGlobalList.invalidate();
  void utils.project.list.invalidate();
  void utils.pilotDreams.getPendingJoinRequests.invalidate();
  if (dreamId) {
    void utils.project.getById.invalidate({ id: dreamId });
  }
}

