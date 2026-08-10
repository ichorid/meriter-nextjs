import type { WalletSnapshot } from '../../../domain/aggregates/wallet/wallet.entity';
import type { WalletTransactionRecord } from '../../../domain/ports/wallet.persistence.port';

type WalletDocumentShape = {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  currency: WalletSnapshot['currency'];
  lastUpdated: Date;
};

type TransactionDocumentShape = {
  id: string;
  walletId: string;
  type: WalletTransactionRecord['type'];
  amount: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export function mapWalletDocumentToSnapshot(doc: WalletDocumentShape): WalletSnapshot {
  return {
    id: doc.id,
    userId: doc.userId,
    communityId: doc.communityId,
    balance: doc.balance,
    currency: doc.currency,
    lastUpdated: doc.lastUpdated,
  };
}

export function mapWalletSnapshotToDocument(snapshot: WalletSnapshot): WalletDocumentShape {
  return { ...snapshot };
}

export function mapTransactionDocumentToRecord(
  doc: TransactionDocumentShape,
): WalletTransactionRecord {
  return {
    id: doc.id,
    walletId: doc.walletId,
    type: doc.type,
    amount: doc.amount,
    description: doc.description,
    referenceType: doc.referenceType,
    referenceId: doc.referenceId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function mapTransactionRecordToDocument(
  record: WalletTransactionRecord,
): TransactionDocumentShape {
  return { ...record };
}
