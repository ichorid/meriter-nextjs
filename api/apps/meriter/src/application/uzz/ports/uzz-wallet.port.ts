export type UzzWalletMode = 'split' | 'shared';

export interface UzzWalletBalance {
  localBalance: number;
  globalBalance: number;
  totalBalance: number;
  mode: UzzWalletMode;
}

export interface UzzWalletOperationInput {
  userId: string;
  localCommunityId: string;
  globalCommunityId: string;
  amount: number;
  operationId: string;
}

export interface UzzWalletReservation {
  operationId: string;
  walletId: string;
  sourceCommunityId: string;
  amount: number;
}

export interface UzzWalletPort {
  getBalances(input: {
    userId: string;
    localCommunityId: string;
    globalCommunityId: string;
  }): Promise<UzzWalletBalance>;
  reservePreferLocal(
    input: UzzWalletOperationInput,
  ): Promise<UzzWalletReservation>;
  refundToSource(input: {
    userId: string;
    sourceCommunityId: string;
    amount: number;
    operationId: string;
  }): Promise<void>;
  /**
   * Debits the sender (local first) and credits the recipient in the same
   * community the debit came from. `recipientUserIds` is the full set of the
   * recipient's linked account ids: the credit lands on whichever of them
   * already has a wallet there; if none does, a wallet is created for the
   * first id, mirroring how the platform lazily creates wallets on credit.
   */
  transferPreferLocal(
    input: UzzWalletOperationInput & { recipientUserIds: string[] },
  ): Promise<UzzWalletReservation>;
}
