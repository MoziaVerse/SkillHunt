import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { db, user } from '../db';
import { getAuthContext } from './auth-context';
import { clearOidcAccessTokenCacheForTests } from './oidc-access-token';

const SERVICE_TOKEN = `test-service-token-${Math.random().toString(36).slice(2)}`;
const KNOWN_USER_ID = 'authctx-user-known';
const KNOWN_SUB = `sso-sub-known-${Math.random().toString(36).slice(2)}`;
const ORIGINAL_OIDC_ISSUER = process.env.OIDC_ISSUER;
const ORIGINAL_SKILLHUNT_OIDC_ISSUER = process.env.SKILLHUNT_OIDC_ISSUER;
const ORIGINAL_SKILLHUNT_OIDC_ALLOWED_CLIENT_IDS = process.env.SKILLHUNT_OIDC_ALLOWED_CLIENT_IDS;
const ORIGINAL_SKILLHUNT_OIDC_AUDIENCE = process.env.SKILLHUNT_OIDC_AUDIENCE;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    process.env[name] = undefined;
    return;
  }
  process.env[name] = value;
}

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
  process.env.SKILLHUNT_ACCESS_TOKENS = undefined;
  restoreEnv('OIDC_ISSUER', ORIGINAL_OIDC_ISSUER);
  restoreEnv('SKILLHUNT_OIDC_ISSUER', ORIGINAL_SKILLHUNT_OIDC_ISSUER);
  restoreEnv('SKILLHUNT_OIDC_ALLOWED_CLIENT_IDS', ORIGINAL_SKILLHUNT_OIDC_ALLOWED_CLIENT_IDS);
  restoreEnv('SKILLHUNT_OIDC_AUDIENCE', ORIGINAL_SKILLHUNT_OIDC_AUDIENCE);
  clearOidcAccessTokenCacheForTests();
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
    expect(ctx.actorType).toBe('service');
    expect(ctx.authMethod).toBe('service_token');
    expect(ctx.scopes).toContain('skills:read_private');
  });

  it('valid service token + unknown X-SSO-SUB → null (matrix should 401 + nudge)', async () => {
    const ctx = await getAuthContext(
      fakeCtx({
        Authorization: `Bearer ${SERVICE_TOKEN}`,
        'X-SSO-SUB': 'never-seen-this-sub',
      }),
    );
    expect(ctx.user).toBeNull();
    expect(ctx.actorType).toBe('anonymous');
  });

  it('valid service token but no X-SSO-SUB header → null', async () => {
    const ctx = await getAuthContext(fakeCtx({ Authorization: `Bearer ${SERVICE_TOKEN}` }));
    expect(ctx.user).toBeNull();
    expect(ctx.actorType).toBe('anonymous');
  });

  it('wrong bearer token → falls through to cookie path; X-SSO-SUB ignored (no escalation)', async () => {
    const ctx = await getAuthContext(
      fakeCtx({
        Authorization: 'Bearer not-the-real-secret',
        'X-SSO-SUB': KNOWN_SUB,
      }),
    );
    expect(ctx.user).toBeNull();
    expect(ctx.actorType).toBe('anonymous');
  });

  it('configured bearer token resolves to a scoped user actor', async () => {
    const token = `user-token-${Math.random().toString(36).slice(2)}`;
    process.env.SKILLHUNT_ACCESS_TOKENS = JSON.stringify([
      {
        token,
        userId: KNOWN_USER_ID,
        clientId: 'test-client',
        scopes: ['profile:read', 'skills:read', 'skills:read_private'],
      },
    ]);

    const ctx = await getAuthContext(fakeCtx({ Authorization: `Bearer ${token}` }));
    expect(ctx.user?.id).toBe(KNOWN_USER_ID);
    expect(ctx.actorType).toBe('user');
    expect(ctx.authMethod).toBe('bearer_token');
    expect(ctx.clientId).toBe('test-client');
    expect(ctx.scopes).toEqual(['profile:read', 'skills:read', 'skills:read_private']);
  });

  it('valid OIDC access token resolves by SSO sub and maps API scopes', async () => {
    const issuer = `https://sso.example/${Math.random().toString(36).slice(2)}`;
    process.env.OIDC_ISSUER = issuer;
    process.env.SKILLHUNT_OIDC_ISSUER = undefined;
    process.env.SKILLHUNT_OIDC_ALLOWED_CLIENT_IDS = 'mclaw';
    process.env.SKILLHUNT_OIDC_AUDIENCE = undefined;
    clearOidcAccessTokenCacheForTests();

    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    jwk.alg = 'RS256';
    jwk.use = 'sig';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === `${issuer}/.well-known/openid-configuration`) {
        return Response.json({ issuer, jwks_uri: `${issuer}/jwks` });
      }
      if (url === `${issuer}/jwks`) {
        return Response.json({ keys: [jwk] });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    try {
      const token = await new SignJWT({
        client_id: 'mclaw',
        scope: 'openid profile email skills:read_private skills:files:read',
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setSubject(KNOWN_SUB)
        .setAudience('mclaw')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);

      const ctx = await getAuthContext(fakeCtx({ Authorization: `Bearer ${token}` }));
      expect(ctx.user?.id).toBe(KNOWN_USER_ID);
      expect(ctx.actorType).toBe('user');
      expect(ctx.authMethod).toBe('oidc_access_token');
      expect(ctx.clientId).toBe('mclaw');
      expect(ctx.scopes).toContain('profile:read');
      expect(ctx.scopes).toContain('skills:read');
      expect(ctx.scopes).toContain('skills:read_private');
      expect(ctx.scopes).toContain('skills:files:read');
      expect(ctx.scopes).not.toContain('skills:write');
    } finally {
      globalThis.fetch = originalFetch;
      clearOidcAccessTokenCacheForTests();
    }
  });

  it('trusted OIDC client without API scope claims falls back to first-party user scopes', async () => {
    const issuer = `https://sso.example/${Math.random().toString(36).slice(2)}`;
    process.env.OIDC_ISSUER = issuer;
    process.env.SKILLHUNT_OIDC_ISSUER = undefined;
    process.env.SKILLHUNT_OIDC_ALLOWED_CLIENT_IDS = 'mclaw';
    process.env.SKILLHUNT_OIDC_AUDIENCE = undefined;
    clearOidcAccessTokenCacheForTests();

    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    jwk.alg = 'RS256';
    jwk.use = 'sig';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === `${issuer}/.well-known/openid-configuration`) {
        return Response.json({ issuer, jwks_uri: `${issuer}/jwks` });
      }
      if (url === `${issuer}/jwks`) {
        return Response.json({ keys: [jwk] });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    try {
      const token = await new SignJWT({ client_id: 'mclaw', permissions: [] })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setSubject(KNOWN_SUB)
        .setAudience('mclaw')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);

      const ctx = await getAuthContext(fakeCtx({ Authorization: `Bearer ${token}` }));
      expect(ctx.user?.id).toBe(KNOWN_USER_ID);
      expect(ctx.authMethod).toBe('oidc_access_token');
      expect(ctx.clientId).toBe('mclaw');
      expect(ctx.scopes).toContain('skills:read');
      expect(ctx.scopes).toContain('skills:read_private');
      expect(ctx.scopes).toContain('skills:files:read');
      expect(ctx.scopes).toContain('skills:write');
    } finally {
      globalThis.fetch = originalFetch;
      clearOidcAccessTokenCacheForTests();
    }
  });

  it('unscoped OIDC token without an explicitly allowed client only gets public scopes', async () => {
    const issuer = `https://sso.example/${Math.random().toString(36).slice(2)}`;
    process.env.OIDC_ISSUER = issuer;
    process.env.SKILLHUNT_OIDC_ISSUER = undefined;
    process.env.SKILLHUNT_OIDC_ALLOWED_CLIENT_IDS = undefined;
    process.env.SKILLHUNT_OIDC_AUDIENCE = undefined;
    clearOidcAccessTokenCacheForTests();

    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    jwk.alg = 'RS256';
    jwk.use = 'sig';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === `${issuer}/.well-known/openid-configuration`) {
        return Response.json({ issuer, jwks_uri: `${issuer}/jwks` });
      }
      if (url === `${issuer}/jwks`) {
        return Response.json({ keys: [jwk] });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    try {
      const token = await new SignJWT({ client_id: 'mclaw', permissions: [] })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setSubject(KNOWN_SUB)
        .setAudience('mclaw')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);

      const ctx = await getAuthContext(fakeCtx({ Authorization: `Bearer ${token}` }));
      expect(ctx.user?.id).toBe(KNOWN_USER_ID);
      expect(ctx.authMethod).toBe('oidc_access_token');
      expect(ctx.scopes).toEqual(['skills:read']);
    } finally {
      globalThis.fetch = originalFetch;
      clearOidcAccessTokenCacheForTests();
    }
  });
});
