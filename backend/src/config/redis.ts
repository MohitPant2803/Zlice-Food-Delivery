import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

interface ICacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
  del(key: string): Promise<number>;
  setex(key: string, seconds: number, value: string): Promise<string | null>;
  isConnected(): boolean;
}

class InMemoryCache implements ICacheService {
  private store = new Map<string, { val: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.val;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<string | null> {
    const expiresAt = mode === 'EX' && duration ? Date.now() + duration * 1000 : undefined;
    this.store.set(key, { val: value, expiresAt });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<string | null> {
    this.store.set(key, { val: value, expiresAt: Date.now() + seconds * 1000 });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  isConnected(): boolean {
    return true;
  }
}

class CacheManager {
  private client: Redis | null = null;
  private fallbackCache = new InMemoryCache();
  private redisConnected = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      this.client = new Redis(env.REDIS_URI, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          if (times > 3) {
            return null; // Stop reconnecting after 3 tries in local/dev
          }
          return Math.min(times * 100, 2000);
        },
      });

      this.client.on('connect', () => {
        this.redisConnected = true;
        logger.info('⚡ Redis client connected successfully');
      });

      this.client.on('error', (err) => {
        if (!this.redisConnected) {
          logger.warn(`⚠️ Redis not reachable at ${env.REDIS_URI}. Falling back to in-memory caching.`);
        } else {
          logger.error('Redis error occurred:', err.message);
        }
        this.redisConnected = false;
      });

      this.client.connect().catch(() => {
        logger.warn('⚠️ Operating in fallback in-memory cache mode (Redis connection deferred).');
      });
    } catch {
      logger.warn('⚠️ Redis initialization bypassed, using in-memory fallback.');
    }
  }

  get instance(): ICacheService {
    if (this.redisConnected && this.client) {
      return this.client as unknown as ICacheService;
    }
    return this.fallbackCache;
  }

  get isUsingRedis(): boolean {
    return this.redisConnected;
  }
}

export const cache = new CacheManager().instance;
