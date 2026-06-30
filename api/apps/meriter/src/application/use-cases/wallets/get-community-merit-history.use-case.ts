import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { GLOBAL_ROLE_SUPERADMIN } from '../../../domain/common/constants/roles.constants';
import {
  enrichMeritHistoryTransactions,
  type MeritHistoryMongoDb,
} from '../../../domain/common/helpers/merit-history-enrichment';
import type { MeritHistoryFilterKey } from '../../../domain/common/helpers/wallet-transaction-history';
import type { CommunityService } from '../../../domain/services/community.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import type { WalletContextResolverService } from '../../../domain/services/wallet-context-resolver.service';
import {
  mapMeritHistoryTransactionRow,
  type MeritHistoryTransactionRowDto,
} from './get-merit-history-transactions.use-case';

export type CommunityMeritHistoryTransactionRowDto = MeritHistoryTransactionRowDto & {
  subjectUserId: string | null;
  subjectDisplayName: string | null;
};

export type CommunityMeritHistoryPageDto = {
  data: CommunityMeritHistoryTransactionRowDto[];
  total: number;
  skip: number;
  limit: number;
  hasMore: boolean;
};

export type GetCommunityMeritHistoryInput = {
  viewerId: string;
  communityId: string;
  category?: MeritHistoryFilterKey;
  cursor?: number;
  skip?: number;
  page?: number;
  limit?: number;
  pageSize?: number;
};

export type GetCommunityMeritHistoryDeps = {
  walletService: WalletService;
  communityService: CommunityService;
  userService: UserService;
  userCommunityRoleService: UserCommunityRoleService;
  walletContextResolverService: WalletContextResolverService;
  db: MeritHistoryMongoDb | undefined;
  batchFetchUsers: (userIds: string[]) => Promise<Map<string, unknown>>;
};

function resolveMeritHistorySkip(input: {
  cursor?: number;
  skip?: number;
  page?: number;
  limit?: number;
  pageSize?: number;
}): { skip: number; limit: number } {
  const pagination = PaginationHelper.parseOptions(input);
  const limit = pagination.limit || 20;
  let skip: number;
  if (typeof input.cursor === 'number') {
    skip = input.cursor;
  } else if (typeof input.skip === 'number') {
    skip = input.skip;
  } else {
    skip = PaginationHelper.getSkip(pagination);
  }
  return { skip, limit };
}

/**
 * BC-02: aggregate team/project merit history reads (inv-16 wallet authoritative reads).
 * Extracted from wallets.getCommunityMeritHistory; enrichment lives in application layer (V-08).
 */
@Injectable()
export class GetCommunityMeritHistoryUseCase {
  constructor(private readonly deps: GetCommunityMeritHistoryDeps) {}

  async execute(input: GetCommunityMeritHistoryInput): Promise<CommunityMeritHistoryPageDto> {
    const community = await this.deps.communityService.getCommunity(input.communityId);
    if (!community) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Community not found',
      });
    }

    const requester = await this.deps.userService.getUserById(input.viewerId);
    const isSuperadmin = requester?.globalRole === GLOBAL_ROLE_SUPERADMIN;
    if (!isSuperadmin) {
      const role = await this.deps.userCommunityRoleService.getRole(
        input.viewerId,
        input.communityId,
      );
      if (!role) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You must be a member of this community to view merit history',
        });
      }
    }

    const category = input.category ?? 'all';
    const { skip, limit } = resolveMeritHistorySkip(input);

    const effectiveContextId =
      await this.deps.walletContextResolverService.resolvePersonalWalletCommunityId(
        community,
        'voting',
      );

    const result = await this.deps.walletService.getCommunityMeritHistoryTransactions(
      effectiveContextId,
      category,
      limit,
      skip,
    );

    const loaded = result.data.length;

    const enrichmentById = await enrichMeritHistoryTransactions(
      input.viewerId,
      result.data.map((tx) => ({
        id: tx.id,
        referenceType: tx.referenceType,
        referenceId: tx.referenceId,
      })),
      {
        db: this.deps.db,
        batchFetchUsers: this.deps.batchFetchUsers,
        meritTransferWalletOwnerByTxId: result.walletOwnerByTxId,
      },
    );

    const subjectIds = [
      ...new Set(
        result.data
          .map((tx) => result.walletOwnerByTxId.get(tx.id))
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];
    const subjectNames = await this.deps.userService.getDisplayNamesByUserIds(subjectIds);

    const data = result.data.map((tx) => {
      const row = mapMeritHistoryTransactionRow(tx, enrichmentById);
      const subjectUserId = result.walletOwnerByTxId.get(tx.id) ?? null;
      return {
        ...row,
        subjectUserId,
        subjectDisplayName:
          subjectUserId != null ? subjectNames.get(subjectUserId) ?? subjectUserId : null,
      };
    });

    return {
      data,
      total: result.total,
      skip,
      limit,
      hasMore: skip + loaded < result.total,
    };
  }
}

export function createGetCommunityMeritHistoryUseCase(
  deps: GetCommunityMeritHistoryDeps,
): GetCommunityMeritHistoryUseCase {
  return new GetCommunityMeritHistoryUseCase(deps);
}
