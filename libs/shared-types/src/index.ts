// Shared domain types for Meriter API and Frontend
// This is the single source of truth for all domain models

// Export Zod schemas and inferred types
export * from './schemas';

// Legacy type exports for backward compatibility (will be removed)
export type Thank = Vote; // Vote replaces Thank
export type CreateThankDto = CreateVoteDto; // Vote DTO replaces Thank DTO
export type ThankWithComment = { vote: Vote; comment?: Comment };

// Additional utility types
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
