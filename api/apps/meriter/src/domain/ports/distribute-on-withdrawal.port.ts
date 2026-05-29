import type { ClientSession } from 'mongoose';

/**
 * Orchestration port (BC-08): split a withdrawal/close amount between author and
 * investors per contract. Implemented in application (DistributeOnWithdrawalUseCase),
 * wired at the composition root so domain services depend on this token, not on the
 * application layer (Zone 8 inversion).
 */
export const DISTRIBUTE_ON_WITHDRAWAL_PORT = Symbol(
  'DISTRIBUTE_ON_WITHDRAWAL_PORT',
);

export type DistributeOnWithdrawalInput = {
  postId: string;
  withdrawAmount: number;
  session?: ClientSession;
  earningsReason?: 'withdrawal' | 'close';
};

export type DistributeOnWithdrawalResult = {
  authorAmount: number;
  investorDistributions: Array<{
    investorId: string;
    amount: number;
  }>;
};

export interface DistributeOnWithdrawalPort {
  execute(input: DistributeOnWithdrawalInput): Promise<DistributeOnWithdrawalResult>;
}
