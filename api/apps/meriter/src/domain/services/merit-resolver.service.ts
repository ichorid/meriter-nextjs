import { Injectable } from '@nestjs/common';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import { isPriorityCommunity } from '../common/helpers/community.helper';

export type MeritOperationType =
  | 'fee'
  | 'voting'
  | 'withdrawal'
  | 'tappalka_reward'
  | 'investment';

export interface CommunityForMeritResolver {
  id: string;
  typeTag?: string;
  isPriority?: boolean;
  /** Project communities use global merits for voting (same as hubs); local id is not a user wallet. */
  isProject?: boolean;
}

/**
 * Resolves which wallet (communityId) to use for merit operations.
 * Fee always uses global wallet. Other operations use global for priority communities.
 */
@Injectable()
export class MeritResolverService {
  /**
   * Get the communityId of the wallet to use for a merit operation.
   * - fee: always global
   * - withdrawal: always global (withdrawn merits go to the same wallet as fee payment)
   * - voting, tappalka_reward, investment: global for priority communities, otherwise community's own
   */
  getWalletCommunityId(
    community: CommunityForMeritResolver | null | undefined,
    operationType: MeritOperationType,
  ): string {
    if (operationType === 'fee' || operationType === 'withdrawal') {
      return GLOBAL_COMMUNITY_ID;
    }

    if (!community) {
      throw new Error('Community is required for non-fee merit operations');
    }

    // Project: merits for voting/spending come from the user's global wallet (MVP), not a per-project wallet.
    if (operationType === 'voting' && community.isProject === true) {
      return GLOBAL_COMMUNITY_ID;
    }

    return isPriorityCommunity(community) ? GLOBAL_COMMUNITY_ID : community.id;
  }
}
