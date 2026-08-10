import type { ClientSession } from 'mongoose';
import type { DistributeOnWithdrawalResult } from './distribute-on-withdrawal.port';

/**
 * Orchestration port (BC-08): close-time pool return and rating distribution for
 * investing posts. Implemented in application (HandlePostCloseUseCase), wired at the
 * composition root (Zone 8 inversion).
 */
export const HANDLE_POST_CLOSE_PORT = Symbol('HANDLE_POST_CLOSE_PORT');

export type HandlePostCloseInput = {
  postId: string;
  session?: ClientSession;
};

export type HandlePostCloseResult = {
  poolReturned: Array<{ investorId: string; amount: number }>;
  ratingDistributed: DistributeOnWithdrawalResult;
  totalRatingDistributed: number;
};

export interface HandlePostClosePort {
  execute(input: HandlePostCloseInput): Promise<HandlePostCloseResult>;
}
