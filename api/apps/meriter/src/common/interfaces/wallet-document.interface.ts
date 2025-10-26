export interface WalletDocument {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  currency: {
    singular: string;
    plural: string;
    genitive: string;
  };
  lastUpdated: Date;
}
