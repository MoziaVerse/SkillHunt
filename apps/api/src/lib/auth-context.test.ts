import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { db, externalIdentities, user } from '../db';
import { getAuthContext } from './auth-context';
import { clearOidcAccessTokenCacheForTests } from './oidc-access-token';

const SERVICE_TOKEN = `test-service-token-${Math.random().toString(36).slice(2)}`;
const KNOWN_USER_ID = 'authctx-user-known';
const KNOWN_SUB = `sso-sub-known-${Math.random().toString(36).slice(2)}`;
const TEST_IDENTITY_ISSUER = 'https://sso.example/test-identity';
const ORIGINAL_OIDC_ISSUER = process.env.OIDC_ISSUER;
const ORIGINAL_SKILLHUNT_OIDC_ISSUER = process.env.SKILLHUNT_OIDC_ISSUER;
const ORIGINAL_SKILLHUNT_SSO_IDENTITY_ISSUER = process.env.SKILLHUNT_SSO_IDENTITY_ISSUER;
const ORIGINAL_SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENTS =
  process.env.SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENTS;
const ORIGINAL_SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENT_IDS =
  process.env.SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENT_IDS;
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

async function withSignedOidcToken(
  payload: Record<string, unknown>,
  subject: string,
  run: (token: string) => Promise<void>,
) {
  const issuer = `https://sso.example/${Math.random().toString(36).slice(2)}`;
  process.env.OIDC_ISSUER = issuer;
  process.env.SKILLHUNT_OIDC_ISSUER = undefined;
  process.env.SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENTS = undefined;
  process.env.SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENT_IDS = 'mclaw';
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
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer)
      .setSubject(subject)
      .setAudience('mclaw')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await run(token);
  } finally {
    globalThis.fetch = originalFetch;
    clearOidcAccessTokenCacheForTests();
  }
}

beforeAll(async () => {
  process.env.SKILLHUB_SERVICE_TOKEN = SERVICE_TOKEN;
  process.env.SKILLHUNT_SSO_IDENTITY_ISSUER = TEST_IDENTITY_ISSUER;
  await db.delete(externalIdentities).where(eq(externalIdentities.subject, KNOWN_SUB));
  await db.delete(user).where(eq(user.id, KNOWN_USER_ID));
  await db.insert(user).values({
    id: KNOWN_USER_ID,
    name: 'Known User',
    handle: 'authctx-known',
    email: 'authctx-known@example.com',
    emailVerified: true,
    ssoSub: KNOWN_SUB,
  });
  await db.insert(externalIdentities).values({
    userId: KNOWN_USER_ID,
    provider: 'casdoor',
    issuer: TEST_IDENTITY_ISSUER,
    subject: KNOWN_SUB,
  });
});

afterAll(async () => {
  await db.delete(externalIdentities).where(eq(externalIdentities.subject, KNOWN_SUB));
  await db.delete(user).where(eq(user.id, KNOWN_USER_ID));
  process.env.SKILLHUB_SERVICE_TOKEN = undefined;
  process.env.SKILLHUNT_ACCESS_TOKENS = undefined;
  restoreEnv('OIDC_ISSUER', ORIGINAL_OIDC_ISSUER);
  restoreEnv('SKILLHUNT_OIDC_ISSUER', ORIGINAL_SKILLHUNT_OIDC_ISSUER);
  restoreEnv('SKILLHUNT_SSO_IDENTITY_ISSUER', ORIGINAL_SKILLHUNT_SSO_IDENTITY_ISSUER);
  restoreEnv(
    'SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENTS',
    ORIGINAL_SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENTS,
  );
  restoreEnv(
    'SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENT_IDS',
    ORIGINAL_SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENT_IDS,
  );
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

  it('valid OIDC access token resolves by external identity and maps API scopes', async () => {
    const issuer = `https://sso.example/${Math.random().toString(36).slice(2)}`;
    process.env.OIDC_ISSUER = issuer;
    process.env.SKILLHUNT_OIDC_ISSUER = undefined;
    process.env.SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENTS = undefined;
    process.env.SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENT_IDS = 'mclaw';
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

  it('valid OIDC access token creates a local user when SSO sub is new', async () => {
    const freshSub = `sso-sub-fresh-${Math.random().toString(36).slice(2)}`;
    const freshEmail = `fresh-${Math.random().toString(36).slice(2)}@example.com`;
    await db.delete(externalIdentities).where(eq(externalIdentities.subject, freshSub));
    await db.delete(user).where(eq(user.ssoSub, freshSub));
    await db.delete(user).where(eq(user.email, freshEmail));

    try {
      await withSignedOidcToken(
        {
          client_id: 'mclaw',
          scope: 'openid profile email phone skills:read_private',
          email: freshEmail,
          name: 'Fresh Maker',
          phone: '+86 133-0000-1064',
        },
        freshSub,
        async (token) => {
          const ctx = await getAuthContext(fakeCtx({ Authorization: `Bearer ${token}` }));
          expect(ctx.user).not.toBeNull();
          expect(ctx.user?.ssoSub).toBe(freshSub);
          expect(ctx.user?.email).toBe(freshEmail);
          expect(ctx.user?.name).toBe('Fresh Maker');
          expect(ctx.authMethod).toBe('oidc_access_token');
          expect(ctx.scopes).toContain('skills:read_private');

          const rows = await db.select().from(user).where(eq(user.ssoSub, freshSub)).limit(1);
          expect(rows[0]?.email).toBe(freshEmail);
          expect(rows[0]?.phone).toBe('13300001064');
          const identities = await db
            .select()
            .from(externalIdentities)
            .where(eq(externalIdentities.subject, freshSub))
            .limit(1);
          expect(identities[0]?.provider).toBe('casdoor');
          expect(identities[0]?.userId).toBe(rows[0]?.id);
        },
      );
    } finally {
      await db.delete(externalIdentities).where(eq(externalIdentities.subject, freshSub));
      await db.delete(user).where(eq(user.ssoSub, freshSub));
      await db.delete(user).where(eq(user.email, freshEmail));
    }
  });

  it('valid OIDC access token binds an existing local user with the same email', async () => {
    const existingId = `authctx-bind-${Math.random().toString(36).slice(2)}`;
    const freshSub = `sso-sub-bind-${Math.random().toString(36).slice(2)}`;
    const email = `bind-${Math.random().toString(36).slice(2)}@example.com`;
    await db.delete(externalIdentities).where(eq(externalIdentities.subject, freshSub));
    await db.delete(user).where(eq(user.id, existingId));
    await db.delete(user).where(eq(user.email, email));

    await db.insert(user).values({
      id: existingId,
      name: 'Existing Local User',
      handle: `bind-${Math.random().toString(36).slice(2)}`,
      email,
      emailVerified: true,
    });

    try {
      await withSignedOidcToken(
        {
          client_id: 'mclaw',
          scope: 'openid profile email skills:read_private',
          email,
          name: 'Bound SSO User',
        },
        freshSub,
        async (token) => {
          const ctx = await getAuthContext(fakeCtx({ Authorization: `Bearer ${token}` }));
          expect(ctx.user?.id).toBe(existingId);
          expect(ctx.user?.ssoSub).toBe(freshSub);
          expect(ctx.user?.name).toBe('Bound SSO User');

          const rows = await db.select().from(user).where(eq(user.id, existingId)).limit(1);
          expect(rows[0]?.ssoSub).toBe(freshSub);
          const identities = await db
            .select()
            .from(externalIdentities)
            .where(eq(externalIdentities.subject, freshSub))
            .limit(1);
          expect(identities[0]?.userId).toBe(existingId);
        },
      );
    } finally {
      await db.delete(externalIdentities).where(eq(externalIdentities.subject, freshSub));
      await db.delete(user).where(eq(user.id, existingId));
      await db.delete(user).where(eq(user.ssoSub, freshSub));
      await db.delete(user).where(eq(user.email, email));
    }
  });

  it('trusted first-party OIDC client without API scope claims uses configured read scopes', async () => {
    const issuer = `https://sso.example/${Math.random().toString(36).slice(2)}`;
    process.env.OIDC_ISSUER = issuer;
    process.env.SKILLHUNT_OIDC_ISSUER = undefined;
    process.env.SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENTS = undefined;
    process.env.SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENT_IDS = 'mclaw';
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
      expect(ctx.scopes).not.toContain('skills:write');
    } finally {
      globalThis.fetch = originalFetch;
      clearOidcAccessTokenCacheForTests();
    }
  });

  it('unscoped OIDC token without an explicitly allowed client only gets public scopes', async () => {
    const issuer = `https://sso.example/${Math.random().toString(36).slice(2)}`;
    process.env.OIDC_ISSUER = issuer;
    process.env.SKILLHUNT_OIDC_ISSUER = undefined;
    process.env.SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENTS = undefined;
    process.env.SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENT_IDS = undefined;
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
