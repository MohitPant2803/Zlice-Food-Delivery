import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const connectDB = async (): Promise<void> => {
  try {
    mongoose.connection.on('connected', () => {
      logger.info('📦 MongoDB successfully connected to cluster');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB connection lost. Reconnecting...');
    });

    await mongoose.connect(env.MONGODB_URI, {
      autoIndex: env.NODE_ENV !== 'production', // Build indexes in dev, run migrations in prod
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error) {
    logger.error('Fatal: Failed to connect to MongoDB', error);
    process.exit(1);
  }
};

export const closeDB = async (): Promise<void> => {
  await mongoose.connection.close();
  logger.info('📦 MongoDB connection closed gracefully');
};
