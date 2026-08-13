import { UzzValidationError } from '../errors';

export interface DemurrageInput {
  nominalRub: number;
  floorRub: number;
  rateRubPerDay: number;
  days: number;
}

export interface DemurrageResult {
  nominalRub: number;
  appliedDays: number;
}

export function applyDemurrage(input: DemurrageInput): DemurrageResult {
  const { nominalRub, floorRub, rateRubPerDay, days } = input;
  if (
    !Number.isSafeInteger(nominalRub) ||
    nominalRub <= 0 ||
    !Number.isSafeInteger(floorRub) ||
    floorRub <= 0 ||
    !Number.isSafeInteger(rateRubPerDay) ||
    rateRubPerDay < 0 ||
    !Number.isSafeInteger(days) ||
    days < 0
  ) {
    throw new UzzValidationError('DEMURRAGE_INPUT_INVALID');
  }

  const reduced = Math.max(1, nominalRub - rateRubPerDay * days);
  const nominalAfterDemurrage =
    nominalRub >= floorRub ? Math.max(floorRub, reduced) : reduced;

  return { nominalRub: nominalAfterDemurrage, appliedDays: days };
}

