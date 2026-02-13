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
   * - voting, withdrawal, tappalka_reward, investment: global for priority communities, otherwise community's own
   */
  getWalletCommunityId(
    community: CommunityForMeritResolver | null | undefined,
    operationType: MeritOperationType,
  ): string {
    if (operationType === 'fee') {
      return GLOBAL_COMMUNITY_ID;
    }

    if (!community) {
      throw new Error('Community is required for non-fee merit operations');
    }

    return isPriorityCommunity(community) ? GLOBAL_COMMUNITY_ID : community.id;
  }
}
