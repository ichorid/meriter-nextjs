export class UzzDomainError extends Error {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UzzValidationError extends UzzDomainError {}

export class UzzConflictError extends UzzDomainError {}

export class UzzForbiddenError extends UzzDomainError {}

export class UzzExpiredError extends UzzDomainError {}

