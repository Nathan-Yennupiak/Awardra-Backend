"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().default('5000'),
    DATABASE_URL: zod_1.z.string().url(),
    JWT_SECRET: zod_1.z.string().min(32),
    JWT_EXPIRES_IN: zod_1.z.string().default('1d'),
    REFRESH_TOKEN_SECRET: zod_1.z.string().min(32),
    REFRESH_TOKEN_EXPIRES_IN: zod_1.z.string().default('7d'),
    PUBLIC_WEB_URL: zod_1.z.string().url(),
    ADMIN_WEB_URL: zod_1.z.string().url(),
    SUPER_ADMIN_WEB_URL: zod_1.z.string().url(),
    PAYSTACK_SECRET_KEY: zod_1.z.string(),
    PAYSTACK_PUBLIC_KEY: zod_1.z.string(),
    PAYSTACK_WEBHOOK_SECRET: zod_1.z.string(),
    PAYSTACK_FEE_PERCENTAGE: zod_1.z.string().default('1.95'),
    CREATOR_FEE_PERCENTAGE: zod_1.z.string().default('5'),
    DEFAULT_NOMINATION_FEE: zod_1.z.string().default('100'),
    DEFAULT_NOMINATION_TARGET: zod_1.z.string().default('100'),
    EXCHANGE_RATE_API_URL: zod_1.z.string().url().optional(),
    EXCHANGE_RATE_API_KEY: zod_1.z.string().optional(),
    EXCHANGE_RATE_CACHE_TTL: zod_1.z.string().default('3600'),
    CLOUDINARY_CLOUD_NAME: zod_1.z.string().optional(),
    CLOUDINARY_API_KEY: zod_1.z.string().optional(),
    CLOUDINARY_API_SECRET: zod_1.z.string().optional(),
});
const _env = envSchema.safeParse(process.env);
if (!_env.success) {
    console.error('❌ Invalid environment variables', _env.error.format());
    process.exit(1);
}
exports.env = _env.data;
