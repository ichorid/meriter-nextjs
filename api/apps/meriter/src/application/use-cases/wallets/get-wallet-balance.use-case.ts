import { Injectable } from '@nestjs/common';
import type { WalletSnapshot } from '../../../domain/aggregates/wallet/wallet.entity';
import { WalletContextResolverService } from '../../../domain/services/wallet-context-resolver.service';
import { WalletService } from '../../../domain/services/wallet.service';

export type WalletBalanceSnapshotDto = Omit<WalletSnapshot, 'lastUpdated'> & {
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * BC-02: authoritative wallet balance reads (inv-16, inv-20).
 * Extracted from wallets.getByCommunity and wallets.getBalance.
 */
@Injectable()
export class GetWalletBalanceUseCase {
  constructor(
    private readonly walletService: WalletService,
    private readonly walletContextResolverService: WalletContextResolverService,
  ) {}

  /** inv-20: priority hub communities route to the global wallet; shared parent+projects use parent id. */
  async resolveWalletCommunityId(communityId: string): Promise<string> {
    return this.walletContextResolverService.resolvePersonalWalletCommunityId(
      communityId,
      'voting',
    );
  }

  /** inv-16: wallet entity is authoritative; balances are never negative on read. */
  getNonNegativeBalance(wallet: { getBalance(): number } | null): number {
    if (!wallet) {
      return 0;
    }
    return Math.max(0, wallet.getBalance());
  }

  async getBalance(params: { userId: string; communityId: string }): Promise<number> {
    const walletCommunityId = await this.resolveWalletCommunityId(params.communityId);
    const wallet = await this.walletService.getWallet(params.userId, walletCommunityId);
    return this.getNonNegativeBalance(wallet);
  }

  async getWalletByCommunity(params: {
    userId: string;
    communityId: string;
  }): Promise<WalletBalanceSnapshotDto | null> {
    const walletCommunityId = await this.resolveWalletCommunityId(params.communityId);
    const wallet = await this.walletService.getUserWallet(params.userId, walletCommunityId);
    if (!wallet) {
      return null;
    }

    const snapshot = wallet.toSnapshot();
    return {
      ...snapshot,
      balance: this.getNonNegativeBalance(wallet),
      lastUpdated: snapshot.lastUpdated.toISOString(),
      createdAt: snapshot.lastUpdated.toISOString(),
      updatedAt: snapshot.lastUpdated.toISOString(),
    };
  }
}
