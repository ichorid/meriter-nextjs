import type { Connection } from 'mongoose';
import type { CommunityService } from '../../domain/services/community.service';
import {
  createGetRemainingQuotaUseCase,
  type CommunityQuotaContext,
} from '../../application/use-cases/wallets/get-remaining-quota.use-case';

/**
 * Remaining daily quota for publication creation (delegates to GetRemainingQuotaUseCase / P-3).
 */
type CommunityQuotaSlice = CommunityQuotaContext;

export async function getRemainingQuotaForPublicationCreate(
  userId: string,
  communityId: string,
  community: CommunityQuotaSlice,
  communityService: CommunityService,
  connection: Pick<Connection, 'db'>,
): Promise<number> {
  if (!connection.db) {
    throw new Error('Database connection not available');
  }

  const getRemainingQuota = createGetRemainingQuotaUseCase({ communityService });
  return getRemainingQuota.forPublicationCreate({
    userId,
    communityId,
    community,
    db: connection.db,
  });
}
