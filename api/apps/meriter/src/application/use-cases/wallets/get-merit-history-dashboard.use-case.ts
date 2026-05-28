import { Injectable } from '@nestjs/common';
import type {
  MeritHistoryDashboardPeriodDays,
  MeritHistoryFilterKey,
} from '../../../domain/common/helpers/wallet-transaction-history';
import type {
  MeritHistoryDashboardResult,
  WalletService,
} from '../../../domain/services/wallet.service';
import {
  GetMeritHistoryTransactionsUseCase,
  type GetMeritHistoryTransactionsDeps,
} from './get-merit-history-transactions.use-case';

export type GetMeritHistoryDashboardInput = {
  viewerId: string;
  userId: string;
  category: MeritHistoryFilterKey;
  periodDays: MeritHistoryDashboardPeriodDays;
  permissionCommunityId?: string;
  communityId?: string;
};

/**
 * BC-02: merit history dashboard aggregates (inv-16 wallet authoritative reads).
 * Extracted from wallets.getMeritHistoryDashboard.
 */
@Injectable()
export class GetMeritHistoryDashboardUseCase {
  private readonly accessGuard: GetMeritHistoryTransactionsUseCase;

  constructor(
    private readonly walletService: WalletService,
    accessDeps: GetMeritHistoryTransactionsDeps,
  ) {
    this.accessGuard = new GetMeritHistoryTransactionsUseCase(accessDeps);
  }

  async execute(input: GetMeritHistoryDashboardInput): Promise<MeritHistoryDashboardResult> {
    await this.accessGuard.assertMeritHistoryTransactionsAccess(
      input.viewerId,
      input.userId,
      input.permissionCommunityId,
    );

    return this.walletService.getMeritHistoryDashboard(
      input.userId,
      input.category,
      input.periodDays,
      input.communityId != null ? { communityId: input.communityId } : undefined,
    );
  }
}

export function createGetMeritHistoryDashboardUseCase(deps: {
  walletService: WalletService;
  accessDeps: GetMeritHistoryTransactionsDeps;
}): GetMeritHistoryDashboardUseCase {
  return new GetMeritHistoryDashboardUseCase(deps.walletService, deps.accessDeps);
}
