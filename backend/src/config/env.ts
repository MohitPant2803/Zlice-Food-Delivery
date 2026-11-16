import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/zlice_db'),
  REDIS_URI: z.string().default('redis://127.0.0.1:6379'),

  // JWT Configuration
  JWT_ACCESS_SECRET: z.string().min(16).default('zlice_super_secret_access_jwt_key_2026_xyz!'),
  JWT_REFRESH_SECRET: z.string().min(16).default('zlice_super_secret_refresh_jwt_key_2026_abc!'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION_DAYS: z.coerce.number().default(7),

  // Security
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:5173'),

  // Cookie settings
  COOKIE_SECRET: z.string().default('zlice_cookie_secret_key_9876543210'),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment configuration:', parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
};

export const env = parseEnv();
