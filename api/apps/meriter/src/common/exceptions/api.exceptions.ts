import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiError extends HttpException {
  constructor(
    message: string,
    code: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: any,
  ) {
    super(
      {
        success: false,
        error: {
          code,
          message,
          details,
        },
      },
      status,
    );
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', HttpStatus.BAD_REQUEST, details);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', HttpStatus.FORBIDDEN);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT', HttpStatus.CONFLICT, details);
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 'INTERNAL_SERVER_ERROR', HttpStatus.INTERNAL_SERVER_ERROR, details);
  }
}
