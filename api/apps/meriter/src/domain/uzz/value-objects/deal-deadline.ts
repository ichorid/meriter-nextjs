import { UzzValidationError } from '../errors';

export class DealDeadline {
  static optionalFuture(
    value: Date | undefined,
    now: Date,
    minimumLeadMs = 300_000,
  ): Date | undefined {
    if (!value) return undefined;
    if (!Number.isFinite(value.getTime()) || value.getTime() < now.getTime() + minimumLeadMs) {
      throw new UzzValidationError('DEAL_DEADLINE_NOT_FUTURE');
    }
    return new Date(value.getTime());
  }
}
