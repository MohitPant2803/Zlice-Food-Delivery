import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { canteenRouter } from './modules/canteens/canteen.routes.js';
import { menuRouter } from './modules/catalog/menu.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { orderRouter } from './modules/orders/order.routes.js';
import { deliveryRouter } from './modules/delivery/delivery.routes.js';
import { trackingRouter } from './modules/tracking/tracking.routes.js';
import { paymentRouter } from './modules/payments/payment.routes.js';
import { ApiError } from './utils/apiError.js';
import { ApiResponse } from './utils/apiResponse.js';

export const createApp = (): Application => {
  const app = express();

  // 1. Security Headers
  app.use(helmet());

  // 2. CORS configuration with multi-origin and credential support
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          callback(null, true);
        } else {
          callback(new Error('Cross-Origin Request Blocked by CORS Policy'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'],
    })
  );

  // 3. Request parsers (with rawBody capture for webhook HMAC signature verification)
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString();
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // 4. Request Logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // 5. Rate limiting for general API requests
  app.use('/api', apiRateLimiter);

  // 6. System Health Check
  app.get('/health', (_req: Request, res: Response) => {
    ApiResponse.success(res, 'Zlice Backend Service Healthy', {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      version: '1.0.0',
    });
  });

  // 7. Core Module Routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/canteens', canteenRouter);
  app.use('/api/v1/menu', menuRouter);
  app.use('/api/v1/cart', cartRouter);
  app.use('/api/v1/orders', orderRouter);
  app.use('/api/v1/delivery', deliveryRouter);
  app.use('/api/v1/tracking', trackingRouter);
  app.use('/api/v1/payments', paymentRouter);

  // 8. 404 Route Handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
  });

  // 9. Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};
