import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1d'),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  PUBLIC_WEB_URL: z.string().url(),
  ADMIN_WEB_URL: z.string().url(),
  SUPER_ADMIN_WEB_URL: z.string().url(),
  PAYSTACK_SECRET_KEY: z.string(),
  PAYSTACK_PUBLIC_KEY: z.string(),
  PAYSTACK_WEBHOOK_SECRET: z.string(),
  PAYSTACK_FEE_PERCENTAGE: z.string().default('1.95'),
  CREATOR_FEE_PERCENTAGE: z.string().default('5'),
  DEFAULT_NOMINATION_FEE: z.string().default('100'),
  DEFAULT_NOMINATION_TARGET: z.string().default('100'),
  EXCHANGE_RATE_API_URL: z.string().url().optional(),
  EXCHANGE_RATE_API_KEY: z.string().optional(),
  EXCHANGE_RATE_CACHE_TTL: z.string().default('3600'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
