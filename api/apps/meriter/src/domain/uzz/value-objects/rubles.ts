import { UzzValidationError } from '../errors';

export class Rubles {
  private constructor(readonly value: number) {}

  static create(value: number): Rubles {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new UzzValidationError('RUBLES_INVALID');
    }

    return new Rubles(value);
  }
}
