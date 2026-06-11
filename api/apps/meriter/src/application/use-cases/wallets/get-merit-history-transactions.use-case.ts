import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { PaginationHelper } from '../../../common/helpers/pagination.helper';
import { GLOBAL_ROLE_SUPERADMIN } from '../../../domain/common/constants/roles.constants';
import {
  enrichMeritHistoryTransactions,
  type MeritHistoryEnrichmentPayload,
  type MeritHistoryMongoDb,
} from '../../../domain/common/helpers/merit-history-enrichment';
import {
  meritHistoryCategoryForReferenceType,
  meritHistoryLedgerMultiplier,
  type MeritHistoryFilterKey,
} from '../../../domain/common/helpers/wallet-transaction-history';
import type { Transaction } from '../../../domain/models/transaction/transaction.schema';
import type { PermissionService } from '../../../domain/services/permission.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import type { WalletContextResolverService } from '../../../domain/services/wallet-context-resolver.service';
import type { CommunityService } from '../../../domain/services/community.service';

export type MeritHistoryTransactionRowDto = Omit<Transaction, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
  meritHistoryCategory: ReturnType<typeof meritHistoryCategoryForReferenceType>;
  ledgerMultiplier: ReturnType<typeof meritHistoryLedgerMultiplier>;
  meritHistoryEnrichment: MeritHistoryEnrichmentPayload | null;
};

export type MeritHistoryTransactionsPageDto = {
  data: MeritHistoryTransactionRowDto[];
  total: number;
  skip: number;
  limit: number;
  hasMore: boolean;
};

export type GetMeritHistoryTransactionsInput = {
  viewerId: string;
  userId: string;
  communityId?: string;
  category?: MeritHistoryFilterKey;
  permissionCommunityId?: string;
  cursor?: number;
  skip?: number;
  page?: number;
  limit?: number;
  pageSize?: number;
};

export type GetMeritHistoryTransactionsDeps = {
  walletService: WalletService;
  userService: UserService;
  permissionService: PermissionService;
  communityService: CommunityService;
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

export function mapMeritHistoryTransactionRow(
  tx: Transaction,
  enrichmentById: ReadonlyMap<string, MeritHistoryEnrichmentPayload | null>,
): MeritHistoryTransactionRowDto {
  const createdAt =
    tx.createdAt instanceof Date ? tx.createdAt.toISOString() : String(tx.createdAt);
  const updatedAt =
    tx.updatedAt instanceof Date ? tx.updatedAt.toISOString() : String(tx.updatedAt);
  const enriched = enrichmentById.get(tx.id);
  return {
    ...tx,
    createdAt,
    updatedAt,
    meritHistoryCategory: meritHistoryCategoryForReferenceType(tx.referenceType),
    ledgerMultiplier: meritHistoryLedgerMultiplier({
      type: tx.type,
      referenceType: tx.referenceType,
    }),
    meritHistoryEnrichment:
      enriched && Object.keys(enriched).length > 0 ? enriched : null,
  };
}

/**
 * BC-02: authoritative global-wallet merit history reads (inv-16, inv-20).
 * Extracted from wallets.getTransactions; enrichment lives in application layer (V-08).
 */
@Injectable()
export class GetMeritHistoryTransactionsUseCase {
  constructor(private readonly deps: GetMeritHistoryTransactionsDeps) {}

  async assertMeritHistoryTransactionsAccess(
    viewerId: string,
    targetUserId: string,
    permissionCommunityId: string | undefined,
  ): Promise<void> {
    if (targetUserId === viewerId) {
      return;
    }
    const requester = await this.deps.userService.getUserById(viewerId);
    const isSuperadmin = requester?.globalRole === GLOBAL_ROLE_SUPERADMIN;
    if (isSuperadmin) {
      return;
    }
    const ctxCommunity = permissionCommunityId?.trim();
    if (!ctxCommunity) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'permissionCommunityId is required to view another user\'s transactions',
      });
    }
    const canView = await this.deps.permissionService.canViewUserMerits(
      viewerId,
      targetUserId,
      ctxCommunity,
    );
    if (!canView) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view this user\'s transactions',
      });
    }
  }

  async execute(input: GetMeritHistoryTransactionsInput): Promise<MeritHistoryTransactionsPageDto> {
    await this.assertMeritHistoryTransactionsAccess(
      input.viewerId,
      input.userId,
      input.permissionCommunityId,
    );

    const { skip, limit } = resolveMeritHistorySkip(input);

    let resolvedCommunityId = input.communityId;
    if (resolvedCommunityId) {
      const community = await this.deps.communityService.getCommunity(resolvedCommunityId);
      if (community) {
        resolvedCommunityId =
          await this.deps.walletContextResolverService.resolvePersonalWalletCommunityId(
            community,
            'voting',
          );
      }
    }

    const result = await this.deps.walletService.getUserTransactions(
      input.userId,
      'all',
      limit,
      skip,
      {
        communityId: resolvedCommunityId,
        category: input.category,
      },
    );

    const loaded = result.data.length;

    const enrichmentById = await enrichMeritHistoryTransactions(
      input.userId,
      result.data.map((tx) => ({
        id: tx.id,
        referenceType: tx.referenceType,
        referenceId: tx.referenceId,
      })),
      {
        db: this.deps.db,
        batchFetchUsers: this.deps.batchFetchUsers,
      },
    );

    const data = result.data.map((tx) => mapMeritHistoryTransactionRow(tx, enrichmentById));

    return {
      data,
      total: result.total,
      skip,
      limit,
      hasMore: skip + loaded < result.total,
    };
  }
}

export function createGetMeritHistoryTransactionsUseCase(
  deps: GetMeritHistoryTransactionsDeps,
): GetMeritHistoryTransactionsUseCase {
  return new GetMeritHistoryTransactionsUseCase(deps);
}
