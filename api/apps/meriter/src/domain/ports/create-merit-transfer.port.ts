import type { MeritTransferWalletType } from '../models/merit-transfer/merit-transfer.schema';

/**
 * Orchestration port (BC-15): peer merit transfer creation (wallet-only debit/credit
 * inside a transaction). Implemented in application (CreateMeritTransferUseCase), wired
 * at the composition root (Zone 8 inversion).
 */
export const CREATE_MERIT_TRANSFER_PORT = Symbol('CREATE_MERIT_TRANSFER_PORT');

export interface MeritTransferRecord {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  comment?: string;
  sourceWalletType: MeritTransferWalletType;
  sourceContextId?: string;
  targetWalletType: MeritTransferWalletType;
  targetContextId?: string;
  communityContextId: string;
  eventPostId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMeritTransferPort {
  execute(rawInput: unknown): Promise<MeritTransferRecord>;
}
