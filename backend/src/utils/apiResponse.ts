import { Response } from 'express';

export interface ApiResponsePayload<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: Record<string, any>;
}

export class ApiResponse {
  static send<T>(
    res: Response,
    statusCode: number,
    message: string,
    data?: T,
    meta?: Record<string, any>
  ): Response {
    const payload: ApiResponsePayload<T> = {
      success: statusCode >= 200 && statusCode < 300,
      statusCode,
      message,
      ...(data !== undefined ? { data } : {}),
      ...(meta !== undefined ? { meta } : {}),
    };
    return res.status(statusCode).json(payload);
  }

  static success<T>(res: Response, message: string, data?: T, meta?: Record<string, any>): Response {
    return ApiResponse.send(res, 200, message, data, meta);
  }

  static created<T>(res: Response, message: string, data?: T, meta?: Record<string, any>): Response {
    return ApiResponse.send(res, 201, message, data, meta);
  }
}
