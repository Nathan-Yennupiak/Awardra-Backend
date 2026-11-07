import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  // Deliberately messy config: trailing slash, spaces and a comma-separated list.
  process.env.PUBLIC_WEB_URL = 'https://awardra.netlify.app/ , http://localhost:3000';
  process.env.ADMIN_WEB_URL = 'http://localhost:3001';
  process.env.SUPER_ADMIN_WEB_URL = 'http://localhost:3002';
  const placeholders: Record<string, string> = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
    JWT_SECRET: 'x'.repeat(32),
    REFRESH_TOKEN_SECRET: 'y'.repeat(32),
    PAYSTACK_SECRET_KEY: 'sk_test_placeholder',
    PAYSTACK_PUBLIC_KEY: 'pk_test_placeholder',
  };
  for (const [key, value] of Object.entries(placeholders)) process.env[key] ??= value;

  const { default: app } = await import('../src/app');
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const preflight = (origin: string) =>
  fetch(`${baseUrl}/api/v1/nominations/initialize`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });

describe('CORS', () => {
  it('allows a configured origin even when the env value has a trailing slash', async () => {
    const res = await preflight('https://awardra.netlify.app');
    expect(res.headers.get('access-control-allow-origin')).toBe('https://awardra.netlify.app');
  });

  it('allows every origin in a comma-separated list', async () => {
    for (const origin of ['http://localhost:3000', 'http://localhost:3001']) {
      const res = await preflight(origin);
      expect(res.headers.get('access-control-allow-origin')).toBe(origin);
    }
  });

  it('rejects an unknown origin', async () => {
    const res = await preflight('https://evil.example.com');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('serves requests with no Origin header (server-side fetches, webhooks)', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });
});
