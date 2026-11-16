import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDB, closeDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { SocketGateway } from './modules/tracking/socket.gateway.js';

const startServer = async () => {
  try {
    logger.info('🚀 Initializing Zlice Backend Service...');

    // 1. Establish Database Connection
    await connectDB();

    // 2. Initialize Express Application
    const app = createApp();

    // 3. Create HTTP Server & Bind Socket.IO Gateway
    const httpServer = http.createServer(app);
    SocketGateway.init(httpServer);
    logger.info('⚡ Socket.IO real-time tracking gateway initialized');

    // 4. Start HTTP & WebSocket Listener
    const server = httpServer.listen(env.PORT, () => {
      logger.info(`✨ Zlice API Server running on port ${env.PORT} in [${env.NODE_ENV}] mode`);
      logger.info(`🔗 Base URL: http://localhost:${env.PORT}`);
      logger.info(`🩺 Health Check: http://localhost:${env.PORT}/health`);
      logger.info(`📡 WebSocket Gateway ready on ws://localhost:${env.PORT}`);
    });

    // 5. Graceful Shutdown Handlers
    const handleGracefulShutdown = async (signal: string) => {
      logger.warn(`🛑 Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        logger.info('🛑 HTTP & WebSocket servers closed.');
        await closeDB();
        logger.info('👋 Process terminated gracefully.');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('⚠️ Forcefully terminating process after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason: any) => {
      logger.error('💥 Unhandled Promise Rejection:', reason);
    });

    process.on('uncaughtException', (err: Error) => {
      logger.error('💥 Uncaught Exception:', err);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Fatal initialization error:', error);
    process.exit(1);
  }
};

startServer();
