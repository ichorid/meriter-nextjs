import type { MeritTransferWalletType } from '@meriter/shared-types';

/** Enriched wallet leg (community / project) for display and deep links. */
export type MeritTransferWalletContextMeta = {
  id: string;
  name: string;
  isProject: boolean;
};

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
  sourceWalletContext?: MeritTransferWalletContextMeta;
  targetWalletType: MeritTransferWalletType;
  targetContextId?: string;
  targetWalletContext?: MeritTransferWalletContextMeta;
  communityContextId: string;
  eventPostId?: string;
  createdAt: string;
  updatedAt?: string;
};

export type MeritTransferFeedMode = 'community' | 'incoming' | 'outgoing';
