export class UzzDomainError extends Error {
  constructor(
    readonly code: string,
    message = code,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UzzValidationError extends UzzDomainError {}

export class UzzConflictError extends UzzDomainError {}

export class UzzForbiddenError extends UzzDomainError {}

export class UzzExpiredError extends UzzDomainError {}

export class UzzInvalidTokenError extends UzzDomainError {}

export class UzzIdentityConflictError extends UzzDomainError {}

export class UzzRateLimitedError extends UzzDomainError {}

export class UzzNotFoundError extends UzzDomainError {}

export class UzzNominalChangedError extends UzzConflictError {
  constructor(currentNominalRub: number) {
    super('NOMINAL_CHANGED', 'NOMINAL_CHANGED', { currentNominalRub });
  }
}
