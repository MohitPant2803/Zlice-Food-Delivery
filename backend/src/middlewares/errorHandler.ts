import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected internal error occurred';
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  let details = err.details || undefined;

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY_CONFLICT';
    const field = Object.keys(err.keyValue || {})[0] || 'resource';
    message = `An account or record with this ${field} already exists.`;
  }

  // Handle Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID_FORMAT';
    message = `Invalid format for identifier: ${err.value}`;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'SCHEMA_VALIDATION_ERROR';
    details = Object.values(err.errors || {}).map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Handle invalid JSON body syntax
  if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    errorCode = 'INVALID_JSON_BODY';
    message = 'Malformed JSON payload provided in request body';
  }

  // Log non-operational (unexpected) bugs
  if (statusCode >= 500) {
    logger.error(`[UNHANDLED_EXCEPTION]: ${err.message}`, {
      stack: err.stack,
      err,
    });
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    errorCode,
    message,
    ...(details ? { details } : {}),
    ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};
