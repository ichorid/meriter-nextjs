import { UzzValidationError } from '../errors';

export class MeritAmount {
  private constructor(readonly value: number) {}

  static create(value: number): MeritAmount {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new UzzValidationError('MERIT_AMOUNT_INVALID');
    }

    return new MeritAmount(value);
  }
}

