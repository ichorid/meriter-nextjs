import { UzzValidationError } from '../errors';

export type PurchaseGateMode = 'nudge' | 'require_min_lots';

export interface PurchaseGateInput {
  mode: PurchaseGateMode;
  activeListingCount: number;
  minimum: number;
}

export interface PurchaseGateDecision {
  allowed: boolean;
  nudge: boolean;
  missingListingCount: number;
}

export function evaluatePurchaseGate(
  input: PurchaseGateInput,
): PurchaseGateDecision {
  if (
    !Number.isSafeInteger(input.activeListingCount) ||
    input.activeListingCount < 0 ||
    !Number.isSafeInteger(input.minimum) ||
    input.minimum < 0
  ) {
    throw new UzzValidationError('PURCHASE_GATE_INPUT_INVALID');
  }

  const missingListingCount = Math.max(
    0,
    input.minimum - input.activeListingCount,
  );
  if (missingListingCount === 0) {
    return { allowed: true, nudge: false, missingListingCount: 0 };
  }

  if (input.mode === 'require_min_lots') {
    return { allowed: false, nudge: false, missingListingCount };
  }

  return { allowed: true, nudge: true, missingListingCount };
}
