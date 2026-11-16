export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errorCode?: string;
  public details?: any;

  constructor(statusCode: number, message: string, isOperational = true, errorCode?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, errorCode?: string, details?: any): ApiError {
    return new ApiError(400, message, true, errorCode || 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Unauthorized access', errorCode?: string): ApiError {
    return new ApiError(401, message, true, errorCode || 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden access: insufficient permissions', errorCode?: string): ApiError {
    return new ApiError(403, message, true, errorCode || 'FORBIDDEN');
  }

  static notFound(message = 'Requested resource not found', errorCode?: string): ApiError {
    return new ApiError(404, message, true, errorCode || 'NOT_FOUND');
  }

  static conflict(message: string, errorCode?: string): ApiError {
    return new ApiError(409, message, true, errorCode || 'CONFLICT');
  }

  static internal(message = 'Internal server error', errorCode?: string): ApiError {
    return new ApiError(500, message, false, errorCode || 'INTERNAL_SERVER_ERROR');
  }
}
