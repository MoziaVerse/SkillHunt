import { type JWTPayload, createRemoteJWKSet, jwtVerify } from 'jose';

export interface VerifiedOidcAccessToken {
  sub: string;
  issuer: string;
  email?: string;
  name?: string;
  clientId: string | null;
  rawScopes: string[];
}

type OidcDiscovery = {
  issuer?: string;
  jwks_uri?: string;
};

const discoveryCache = new Map<
  string,
  Promise<{ issuer: string; jwks: ReturnType<typeof createRemoteJWKSet> }>
>();

const optionalEnv = (name: string): string | null => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

const normalizeIssuer = (issuer: string) => issuer.trim().replace(/\/+$/, '');

function stringClaim(payload: JWTPayload, name: string): string | undefined {
  const value = payload[name];
  return typeof value === 'string' && value ? value : undefined;
}

function arrayStringClaim(payload: JWTPayload, name: string): string[] {
  const value = payload[name];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  return [];
}

function tokenClientIds(payload: JWTPayload): string[] {
  const ids = new Set<string>();
  const aud = payload.aud;
  if (typeof aud === 'string') ids.add(aud);
  if (Array.isArray(aud)) {
    for (const item of aud) ids.add(item);
  }
  const azp = stringClaim(payload, 'azp');
  const clientId = stringClaim(payload, 'client_id');
  if (azp) ids.add(azp);
  if (clientId) ids.add(clientId);
  return [...ids];
}

function tokenScopes(payload: JWTPayload): string[] {
  const scopes = new Set<string>();
  const scope = stringClaim(payload, 'scope');
  if (scope) {
    for (const item of scope.split(/\s+/)) {
      if (item) scopes.add(item);
    }
  }
  for (const item of arrayStringClaim(payload, 'scp')) scopes.add(item);
  for (const item of arrayStringClaim(payload, 'permissions')) scopes.add(item);
  return [...scopes];
}

async function loadOidcVerifier(issuer: string) {
  const normalized = normalizeIssuer(issuer);
  let cached = discoveryCache.get(normalized);
  if (!cached) {
    cached = (async () => {
      const response = await fetch(`${normalized}/.well-known/openid-configuration`);
      if (!response.ok) {
        throw new Error(`OIDC discovery failed: ${response.status}`);
      }
      const metadata = (await response.json()) as OidcDiscovery;
      if (!metadata.jwks_uri) {
        throw new Error('OIDC discovery did not include jwks_uri');
      }
      return {
        issuer: normalizeIssuer(metadata.issuer ?? normalized),
        jwks: createRemoteJWKSet(new URL(metadata.jwks_uri)),
      };
    })();
    discoveryCache.set(normalized, cached);
  }
  return cached;
}

export async function verifyOidcAccessToken(
  token: string,
): Promise<VerifiedOidcAccessToken | null> {
  const issuer = optionalEnv('SKILLHUNT_OIDC_ISSUER') ?? optionalEnv('OIDC_ISSUER');
  if (!issuer) return null;

  try {
    const { issuer: verifiedIssuer, jwks } = await loadOidcVerifier(issuer);
    const audience = optionalEnv('SKILLHUNT_OIDC_AUDIENCE') ?? undefined;
    const { payload } = await jwtVerify(token, jwks, {
      issuer: verifiedIssuer,
      audience,
    });
    if (!payload.sub) return null;

    const clientIds = tokenClientIds(payload);

    return {
      sub: payload.sub,
      issuer: verifiedIssuer,
      email: stringClaim(payload, 'email'),
      name:
        stringClaim(payload, 'name') ??
        stringClaim(payload, 'displayName') ??
        stringClaim(payload, 'preferred_username'),
      clientId: clientIds[0] ?? null,
      rawScopes: tokenScopes(payload),
    };
  } catch {
    return null;
  }
}

export function clearOidcAccessTokenCacheForTests() {
  discoveryCache.clear();
}
