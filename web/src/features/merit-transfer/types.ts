import type { MeritTransferWalletType } from '@meriter/shared-types';

/** Row shape returned by `meritTransfer.getByCommunity` / `getByUser` (ISO date strings). */
export type MeritTransferListItem = {
  id: string;
  senderId: string;
  receiverId: string;
  senderDisplayName?: string;
  receiverDisplayName?: string;
  amount: number;
  comment?: string;
  sourceWalletType: MeritTransferWalletType;
  sourceContextId?: string;
  targetWalletType: MeritTransferWalletType;
  targetContextId?: string;
  communityContextId: string;
  eventPostId?: string;
  createdAt: string;
  updatedAt?: string;
};

export type MeritTransferFeedMode = 'community' | 'incoming' | 'outgoing';
