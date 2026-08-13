import { UzzValidationError } from '../../domain/uzz/errors';
import { UzzSettingsRecord } from './ports/uzz-repositories';

export const UZZ_SETTINGS_DEFAULTS = {
  emissionThreshold: 10,
  initialHops: 10,
  demurrageRubPerDay: 100,
  nominalFloorRub: 100,
  minimumListingsToBuy: 3,
  purchaseGateMode: 'nudge' as const,
  requestTtlHours: 48,
  fulfillmentTtlDays: 7,
  confirmationTtlDays: 7,
};

export type UzzSettingsPatch = Partial<Omit<
  UzzSettingsRecord,
  'communityId' | 'createdAt' | 'updatedAt' | 'version'
>>;

const INTEGER_BOUNDS: Record<Exclude<keyof UzzSettingsPatch, 'purchaseGateMode'>, [number, number]> = {
  emissionThreshold: [1, 1_000_000],
  initialHops: [1, 1_000],
  demurrageRubPerDay: [0, 1_000_000],
  nominalFloorRub: [1, 1_000_000_000],
  minimumListingsToBuy: [0, 100],
  requestTtlHours: [1, 8_760],
  fulfillmentTtlDays: [1, 3_650],
  confirmationTtlDays: [1, 3_650],
};

export function validateSettingsPatch(patch: UzzSettingsPatch): void {
  for (const [key, bounds] of Object.entries(INTEGER_BOUNDS)) {
    const value = patch[key as keyof typeof INTEGER_BOUNDS];
    if (value === undefined) continue;
    if (!Number.isSafeInteger(value) || value < bounds[0] || value > bounds[1]) {
      throw new UzzValidationError('SETTINGS_VALUE_INVALID', 'SETTINGS_VALUE_INVALID', {
        field: key, minimum: bounds[0], maximum: bounds[1],
      });
    }
  }
  if (patch.purchaseGateMode !== undefined &&
      !['nudge', 'require_min_lots'].includes(patch.purchaseGateMode)) {
    throw new UzzValidationError('SETTINGS_PURCHASE_GATE_INVALID');
  }
}

export function defaultSettings(communityId: string, now: Date): UzzSettingsRecord {
  return {
    communityId,
    ...UZZ_SETTINGS_DEFAULTS,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    version: 0,
  };
}
