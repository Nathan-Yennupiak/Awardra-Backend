import crypto from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';

// env.ts validates process.env at import time and exits on failure, so supply
// placeholders for anything a local .env does not already provide.
const placeholders: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
  JWT_SECRET: 'x'.repeat(32),
  REFRESH_TOKEN_SECRET: 'y'.repeat(32),
  PUBLIC_WEB_URL: 'http://localhost:3000',
  ADMIN_WEB_URL: 'http://localhost:3001',
  SUPER_ADMIN_WEB_URL: 'http://localhost:3002',
  PAYSTACK_SECRET_KEY: 'sk_test_placeholder',
  PAYSTACK_PUBLIC_KEY: 'pk_test_placeholder',
};

let PaystackService: typeof import('../src/integrations/paystack/paystack.service').PaystackService;
let secretKey: string;

beforeAll(async () => {
  for (const [key, value] of Object.entries(placeholders)) process.env[key] ??= value;
  ({ PaystackService } = await import('../src/integrations/paystack/paystack.service'));
  ({ env: { PAYSTACK_SECRET_KEY: secretKey } } = await import('../src/config/env'));
});

const sign = (body: Buffer, key = secretKey) =>
  crypto.createHmac('sha512', key).update(body).digest('hex');

describe('PaystackService.verifySignature', () => {
  // Paystack's own serialisation: spacing differs from JSON.stringify of the parsed body.
  const rawBody = Buffer.from('{"event": "charge.success", "data": {"reference": "ABC", "amount": 10199}}');

  it('accepts a signature over the exact raw body', () => {
    expect(PaystackService.verifySignature(rawBody, sign(rawBody))).toBe(true);
  });

  it('rejects a signature made with a different key', () => {
    expect(PaystackService.verifySignature(rawBody, sign(rawBody, 'sk_other'))).toBe(false);
  });

  it('rejects a body that was altered after signing', () => {
    const tampered = Buffer.from(rawBody.toString().replace('10199', '1'));
    expect(PaystackService.verifySignature(tampered, sign(rawBody))).toBe(false);
  });

  it('rejects missing input', () => {
    expect(PaystackService.verifySignature(undefined, sign(rawBody))).toBe(false);
    expect(PaystackService.verifySignature(rawBody, '')).toBe(false);
  });
});
