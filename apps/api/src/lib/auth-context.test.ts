import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { db, user } from '../db';
import { getAuthContext } from './auth-context';

const SERVICE_TOKEN = `test-service-token-${Math.random().toString(36).slice(2)}`;
const KNOWN_USER_ID = 'authctx-user-known';
const KNOWN_SUB = `sso-sub-known-${Math.random().toString(36).slice(2)}`;

const fakeCtx = (headers: Record<string, string>): Context => {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    req: {
      header: (k: string) => lower[k.toLowerCase()],
      raw: { headers: new Headers(headers) },
    },
  } as unknown as Context;
};

beforeAll(async () => {
  process.env.SKILLHUB_SERVICE_TOKEN = SERVICE_TOKEN;
  await db.delete(user).where(eq(user.id, KNOWN_USER_ID));
  await db.insert(user).values({
    id: KNOWN_USER_ID,
    name: 'Known User',
    handle: 'authctx-known',
    email: 'authctx-known@example.com',
    emailVerified: true,
    ssoSub: KNOWN_SUB,
  });
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, KNOWN_USER_ID));
  process.env.SKILLHUB_SERVICE_TOKEN = undefined;
});

describe('getAuthContext — service-token (matrix proxy) path', () => {
  it('valid service token + known X-SSO-SUB → resolves to that user', async () => {
    const ctx = await getAuthContext(
      fakeCtx({
        Authorization: `Bearer ${SERVICE_TOKEN}`,
        'X-SSO-SUB': KNOWN_SUB,
      }),
    );
    expect(ctx.user).not.toBeNull();
    expect(ctx.user?.id).toBe(KNOWN_USER_ID);
    expect(ctx.user?.ssoSub).toBe(KNOWN_SUB);
    expect(ctx.user?.name).toBe('Known User');
  });

  it('valid service token + unknown X-SSO-SUB → null (matrix should 401 + nudge)', async () => {
    const ctx = await getAuthContext(
      fakeCtx({
        Authorization: `Bearer ${SERVICE_TOKEN}`,
        'X-SSO-SUB': 'never-seen-this-sub',
      }),
    );
    expect(ctx.user).toBeNull();
  });

  it('valid service token but no X-SSO-SUB header → null', async () => {
    const ctx = await getAuthContext(fakeCtx({ Authorization: `Bearer ${SERVICE_TOKEN}` }));
    expect(ctx.user).toBeNull();
  });

  it('wrong bearer token → falls through to cookie path; X-SSO-SUB ignored (no escalation)', async () => {
    const ctx = await getAuthContext(
      fakeCtx({
        Authorization: 'Bearer not-the-real-secret',
        'X-SSO-SUB': KNOWN_SUB,
      }),
    );
    expect(ctx.user).toBeNull();
  });
});
