// Shared domain types for Meriter API and Frontend
// This is the single source of truth for all domain models

// Export base schemas first
export * from './base-schemas';

// Export Zod schemas and inferred types
export * from './schemas';

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
