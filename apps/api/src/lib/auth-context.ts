import type { Context } from 'hono';
import { findUserById } from '../services/skill-service';
import { auth } from './auth';
import { verifyOidcAccessToken } from './oidc-access-token';
import { findUserBySsoSubject, resolveSsoUser } from './sso-user';

export const API_SCOPES = [
  'profile:read',
  'skills:read',
  'skills:read_private',
  'skills:files:read',
  'skills:install',
  'skills:write',
  'community:write',
  'notifications:read',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];
export type ActorType = 'anonymous' | 'user' | 'service';
export type AuthMethod =
  | 'anonymous'
  | 'cookie'
  | 'bearer_token'
  | 'service_token'
  | 'oidc_access_token';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  ssoSub: string | null;
}

export interface AuthContext {
  actorType: ActorType;
  authMethod: AuthMethod;
  user: AuthUser | null;
  clientId: string | null;
  scopes: ApiScope[];
}

const PUBLIC_SCOPES: ApiScope[] = ['skills:read'];
const FIRST_PARTY_USER_SCOPES: ApiScope[] = [...API_SCOPES];
const TRUSTED_FIRST_PARTY_DEFAULT_SCOPES: ApiScope[] = [
  'profile:read',
  'skills:read',
  'skills:read_private',
  'skills:files:read',
];
const SERVICE_SCOPES: ApiScope[] = [...API_SCOPES];

export const anonymousAuthContext = (): AuthContext => ({
  actorType: 'anonymous',
  authMethod: 'anonymous',
  user: null,
  clientId: null,
  scopes: [...PUBLIC_SCOPES],
});

const userContext = (
  user: AuthUser,
  authMethod: AuthMethod,
  scopes: ApiScope[] = FIRST_PARTY_USER_SCOPES,
  clientId: string | null = null,
): AuthContext => ({
  actorType: authMethod === 'service_token' ? 'service' : 'user',
  authMethod,
  user,
  clientId,
  scopes: [...scopes],
});

export function hasScope(ctx: AuthContext, scope: ApiScope): boolean {
  return ctx.scopes.includes(scope);
}

function normalizeScopes(input: unknown): ApiScope[] {
  if (!Array.isArray(input)) return [];
  const valid = new Set<ApiScope>(API_SCOPES);
  return input.filter((scope): scope is ApiScope => valid.has(scope as ApiScope));
}

const splitListEnv = (name: string): string[] =>
  (process.env[name] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

function scopesFromOidcClaims(rawScopes: string[]): ApiScope[] {
  const scopes = new Set<ApiScope>(PUBLIC_SCOPES);
  const standardProfileScopes = new Set(['openid', 'profile', 'email', 'phone']);
  if (rawScopes.some((scope) => standardProfileScopes.has(scope))) {
    scopes.add('profile:read');
  }
  for (const scope of normalizeScopes(rawScopes)) {
    scopes.add(scope);
  }
  return [...scopes];
}

function trustedFirstPartyClientScopes(clientId: string | null): ApiScope[] | null {
  if (!clientId) return null;

  const configured = process.env.SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENTS?.trim();
  if (configured) {
    try {
      const parsed = JSON.parse(configured) as unknown;
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (!entry || typeof entry !== 'object') continue;
          const entryClientId = 'clientId' in entry ? entry.clientId : null;
          if (entryClientId !== clientId) continue;
          const scopes = normalizeScopes('scopes' in entry ? entry.scopes : []);
          return scopes.length > 0 ? scopes : [...TRUSTED_FIRST_PARTY_DEFAULT_SCOPES];
        }
      }
    } catch {
      // Malformed config should fail closed for private/write scopes.
    }
  }

  const clientIds = new Set(splitListEnv('SKILLHUNT_TRUSTED_FIRST_PARTY_CLIENT_IDS'));
  if (!clientIds.has(clientId)) return null;
  return [...TRUSTED_FIRST_PARTY_DEFAULT_SCOPES];
}

function scopesForOidcAccessToken(rawScopes: string[], clientId: string | null): ApiScope[] {
  const apiScopes = normalizeScopes(rawScopes);
  if (apiScopes.length > 0) return scopesFromOidcClaims(rawScopes);

  const trustedScopes = trustedFirstPartyClientScopes(clientId);
  if (trustedScopes) return trustedScopes;

  return scopesFromOidcClaims(rawScopes);
}

function bearerFromHeader(header: string | undefined): string | null {
  return header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;
}

function configuredAccessTokens(): Array<{
  token: string;
  userId: string;
  scopes: ApiScope[];
  clientId: string | null;
}> {
  const raw = process.env.SKILLHUNT_ACCESS_TOKENS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const token = 'token' in entry ? entry.token : null;
        const userId = 'userId' in entry ? entry.userId : null;
        if (typeof token !== 'string' || typeof userId !== 'string') return null;
        const scopes = normalizeScopes('scopes' in entry ? entry.scopes : []);
        return {
          token,
          userId,
          scopes: scopes.length > 0 ? scopes : [...PUBLIC_SCOPES],
          clientId:
            'clientId' in entry && typeof entry.clientId === 'string' ? entry.clientId : null,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  } catch {
    return [];
  }
}

/**
 * Resolve the current request's actor.
 *
 * Priority:
 *   1) `Authorization: Bearer <SKILLHUB_SERVICE_TOKEN>` + `X-SSO-SUB: <sub>` —
 *      trusted service-to-service path used by the matrix backend proxy
 *      (spec 04). The service token gates the X-SSO-SUB header; without a
 *      matching token, X-SSO-SUB is ignored entirely (no privilege escalation).
 *   2) configured user bearer tokens from SKILLHUNT_ACCESS_TOKENS. This is a
 *      lightweight bridge for the single /api surface before OAuth is wired.
 *   3) Casdoor/OIDC access tokens from trusted clients. These are verified
 *      through the issuer's discovery document and mapped by the `sub` claim.
 *   4) better-auth cookie session (the normal browser path).
 */
export async function getAuthContext(c: Context): Promise<AuthContext> {
  const serviceToken = process.env.SKILLHUB_SERVICE_TOKEN;
  const authHeader = c.req.header('authorization') ?? c.req.header('Authorization');
  const bearer = bearerFromHeader(authHeader);
  if (serviceToken && bearer === serviceToken) {
    const sub = c.req.header('x-sso-sub');
    if (!sub) return anonymousAuthContext();
    const row = await findUserBySsoSubject(sub);
    if (!row) return anonymousAuthContext();
    return userContext(
      { id: row.id, email: row.email, name: row.name, ssoSub: sub },
      'service_token',
      SERVICE_SCOPES,
      'internal-service',
    );
  }

  if (bearer) {
    const token = configuredAccessTokens().find((entry) => entry.token === bearer);
    if (token) {
      const row = await findUserById(token.userId);
      if (!row) return anonymousAuthContext();
      return userContext(
        { id: row.id, email: row.email, name: row.name, ssoSub: row.ssoSub ?? null },
        'bearer_token',
        token.scopes,
        token.clientId,
      );
    }

    const oidc = await verifyOidcAccessToken(bearer);
    if (oidc) {
      const row = await resolveSsoUser({
        provider: 'casdoor',
        issuer: oidc.issuer,
        subject: oidc.sub,
        email: oidc.email,
        name: oidc.name,
        phone: oidc.phone,
      });
      return userContext(
        { id: row.id, email: row.email, name: row.name, ssoSub: row.ssoSub ?? oidc.sub },
        'oidc_access_token',
        scopesForOidcAccessToken(oidc.rawScopes, oidc.clientId),
        oidc.clientId,
      );
    }
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return anonymousAuthContext();

  const u = session.user as {
    id: string;
    email: string;
    name: string;
    ssoSub?: string | null;
  };
  return userContext(
    { id: u.id, email: u.email, name: u.name, ssoSub: u.ssoSub ?? null },
    'cookie',
  );
}
