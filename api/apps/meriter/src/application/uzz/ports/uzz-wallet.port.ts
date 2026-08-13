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
  }): Promise<{ localBalance: number; globalBalance: number }>;
  reservePreferLocal(
    input: UzzWalletOperationInput,
  ): Promise<UzzWalletReservation>;
  refundToSource(input: {
    userId: string;
    sourceCommunityId: string;
    amount: number;
    operationId: string;
  }): Promise<void>;
  transferPreferLocal(
    input: UzzWalletOperationInput & { recipientUserId: string },
  ): Promise<UzzWalletReservation>;
}
