export * from './base-schemas';
export * from './schemas';
export interface UpdatesFrequencySettings {
    frequency: string;
}
export interface WithdrawRequest {
    amount: number;
    memo?: string;
}
export interface TransferRequest {
    toUserId: string;
    amount: number;
    description?: string;
}
//# sourceMappingURL=index.d.ts.map