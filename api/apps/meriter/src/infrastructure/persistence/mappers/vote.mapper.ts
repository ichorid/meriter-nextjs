import type { VoteRecord } from '../../../domain/ports/vote.persistence.port';

type VoteDocumentShape = {
  id: string;
  targetType: VoteRecord['targetType'];
  targetId: string;
  userId: string;
  amountQuota: number;
  amountWallet: number;
  direction: VoteRecord['direction'];
  comment?: string;
  images?: string[];
  communityId: string;
  createdAt: Date;
  updatedAt?: Date;
};

export function mapVoteDocumentToRecord(doc: VoteDocumentShape): VoteRecord {
  return {
    id: doc.id,
    targetType: doc.targetType,
    targetId: doc.targetId,
    userId: doc.userId,
    amountQuota: doc.amountQuota,
    amountWallet: doc.amountWallet,
    direction: doc.direction,
    comment: doc.comment,
    images: doc.images,
    communityId: doc.communityId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function mapVoteRecordToDocument(record: VoteRecord): VoteDocumentShape {
  return { ...record };
}
