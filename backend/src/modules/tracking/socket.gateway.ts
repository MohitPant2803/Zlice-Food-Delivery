import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/token.service.js';
import { TrackingService } from './tracking.service.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import { UserRole } from '../../constants/roles.js';

let ioInstance: Server | null = null;

export class SocketGateway {
  static init(httpServer: HttpServer): Server {
    const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

    const io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
          } else {
            callback(new Error('Cross-Origin WebSocket connection blocked'));
          }
        },
        credentials: true,
      },
      pingTimeout: 20000,
      pingInterval: 10000,
    });

    // 1. JWT Authentication Middleware for WebSockets
    io.use(async (socket: Socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          (socket.handshake.headers.authorization &&
            socket.handshake.headers.authorization.split(' ')[1]);

        if (!token) {
          return next(new Error('Authentication token required to connect to live stream'));
        }

        const payload = TokenService.verifyAccessToken(token);

        // Check if session was revoked in Redis
        const isRevoked = await TokenService.isSessionRevoked(payload.sessionId);
        if (isRevoked) {
          return next(new Error('Session revoked'));
        }

        socket.data.user = payload;
        next();
      } catch (err: any) {
        logger.warn(`WebSocket handshake rejected: ${err.message}`);
        next(new Error(`Unauthorized: ${err.message}`));
      }
    });

    // 2. Connection Lifecycle & Event Routing
    io.on('connection', (socket: Socket) => {
      const user = socket.data.user;
      logger.info(`⚡ Socket connected: [${socket.id}] | User: ${user.email} (${user.role})`);

      // Delivery Partner Channel Subscription
      if (user.role === UserRole.DELIVERY_PARTNER) {
        socket.join(`partner:${user.userId}`);
      }

      // Canteen Channel Subscription
      if (user.canteenId) {
        socket.join(`canteen:${user.canteenId}`);
      }

      // Customer or Partner Joins Order Tracking Room
      socket.on('join_order_tracking', async (data: { orderId: string }) => {
        try {
          const { orderId } = data;
          if (!orderId) {
            socket.emit('tracking_error', { message: 'orderId is required' });
            return;
          }

          // Strict Channel Authorization Check
          await TrackingService.verifyTrackingAccess(orderId, user);

          const room = `order:${orderId}:tracking`;
          socket.join(room);

          // Immediately send latest cached position to avoid blank initial map
          const latestState = await TrackingService.getLatestTracking(orderId);
          socket.emit('order:tracking:snapshot', latestState);

          logger.info(`User [${user.email}] joined tracking room: ${room}`);
        } catch (err: any) {
          socket.emit('tracking_error', { message: err.message || 'Access denied to tracking channel' });
        }
      });

      // Customer Leaves Tracking Room
      socket.on('leave_order_tracking', (data: { orderId: string }) => {
        if (data?.orderId) {
          const room = `order:${data.orderId}:tracking`;
          socket.leave(room);
          logger.info(`User [${user.email}] left tracking room: ${room}`);
        }
      });

      // High-Frequency GPS Stream from Delivery Partner Mobile App
      socket.on('partner_location_update', async (data: {
        orderId: string;
        coordinates: [number, number]; // [lng, lat]
        speedKmh?: number;
        headingDegrees?: number;
        accuracyMeters?: number;
      }) => {
        try {
          if (user.role !== UserRole.DELIVERY_PARTNER) {
            socket.emit('tracking_error', { message: 'Only delivery partners can publish GPS updates' });
            return;
          }

          const liveState = await TrackingService.ingestLocation({
            orderId: data.orderId,
            partnerId: user.userId,
            coordinates: data.coordinates,
            speedKmh: data.speedKmh,
            headingDegrees: data.headingDegrees,
            accuracyMeters: data.accuracyMeters,
          });

          // Broadcast to everyone in this order's tracking room (Customer, Canteen, Admin)
          io.to(`order:${data.orderId}:tracking`).emit('order:tracking:update', liveState);
        } catch (err: any) {
          socket.emit('tracking_error', { message: err.message });
        }
      });

      // Disconnect event
      socket.on('disconnect', (reason) => {
        logger.info(`🔌 Socket disconnected: [${socket.id}] | Reason: ${reason}`);
      });
    });

    ioInstance = io;
    return io;
  }

  static getIO(): Server {
    if (!ioInstance) {
      throw new Error('Socket.IO gateway has not been initialized yet');
    }
    return ioInstance;
  }

  /**
   * Broadcast an order status update to customer and canteen rooms.
   */
  static broadcastOrderStatus(orderId: string, canteenId: string, status: string, payload: any): void {
    if (!ioInstance) return;
    ioInstance.to(`order:${orderId}:tracking`).emit('order:status:change', { orderId, status, payload });
    ioInstance.to(`canteen:${canteenId}`).emit('canteen:order:updated', { orderId, status, payload });
  }
}
