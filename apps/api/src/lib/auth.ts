import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth } from 'better-auth/plugins';
import { db } from '../db';
import { account, session, user, verification } from '../db/auth-schema';

// Harmless fallbacks: keep the module importable even if SSO isn't wired yet
// (e.g. fresh clone, test runs, or browsing public skills locally without Casdoor).
// Real sign-in only works once OIDC_* + BETTER_AUTH_* are filled in apps/api/.env.
const FALLBACKS = {
  OIDC_CLIENT_ID: 'unset-client-id',
  OIDC_CLIENT_SECRET: 'unset-client-secret',
  OIDC_ISSUER: 'http://localhost:0',
  BETTER_AUTH_SECRET: 'dev-only-insecure-secret-please-override-via-env',
  BETTER_AUTH_URL: `http://localhost:${process.env.PORT ?? '3333'}`,
} as const;

const missing: string[] = [];
const cfg = (key: keyof typeof FALLBACKS): string => {
  const v = process.env[key];
  if (v) return v;
  if (process.env.NODE_ENV !== 'test') missing.push(key);
  return FALLBACKS[key];
};

// Vite dev origin proxies /api → :3333, so the request's Origin header is
// `http://localhost:5180` while baseURL is `http://localhost:3333`. Allowlist
// both, plus anything in TRUSTED_ORIGINS (comma-separated, for prod hosts).
const trustedOrigins = [
  cfg('BETTER_AUTH_URL'),
  'http://localhost:5180',
  ...(process.env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
];

// providerId controls our callback URL slug:
// `<BETTER_AUTH_URL>/api/auth/oauth2/callback/<OIDC_PROVIDER_ID>`.
// Set this to whatever the SSO admin actually whitelisted (e.g. the
// application's `name` in Casdoor).
export const OIDC_PROVIDER_ID = process.env.OIDC_PROVIDER_ID ?? 'mozia-sso';

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

// `handle` is the URL-safe identifier used in /u/:handle and
// /skills/:handle/:slug. SSO names ("Zeo", "John Smith", "张三") get
// sanitized to lowercase + dashes for the handle; the original name is kept
// as-is in user.name for display.
function sanitizeHandle(input: string | undefined, sub: string): string {
  if (!input) return `user-${sub.slice(0, 8)}`;
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return cleaned || `user-${sub.slice(0, 8)}`;
}

export const auth = betterAuth({
  baseURL: cfg('BETTER_AUTH_URL'),
  secret: cfg('BETTER_AUTH_SECRET'),
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: { user, session, account, verification },
  }),
  user: {
    additionalFields: {
      ssoSub: { type: 'string', required: false },
      handle: { type: 'string', required: false, input: false },
    },
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: OIDC_PROVIDER_ID,
          clientId: cfg('OIDC_CLIENT_ID'),
          clientSecret: cfg('OIDC_CLIENT_SECRET'),
          discoveryUrl: `${cfg('OIDC_ISSUER')}/.well-known/openid-configuration`,
          scopes: ['openid', 'profile', 'email'],
          mapProfileToUser: (profile: Record<string, unknown>) => {
            const sub = str(profile.sub) ?? str(profile.id) ?? 'unknown';
            // Synthesize a stable pseudo-email when the SSO doesn't return one,
            // so better-auth's NOT NULL email constraint doesn't block sign-in.
            // Format: `<sub>@no-email.<oidc-host>` — guaranteed unique per user.
            let issuerHost = 'sso.local';
            try {
              issuerHost = new URL(cfg('OIDC_ISSUER')).host || issuerHost;
            } catch {
              /* keep default */
            }
            const email = str(profile.email) ?? `${sub}@no-email.${issuerHost}`;
            // Display name: keep SSO original (mixed case, Chinese, etc.).
            const rawName =
              str(profile.displayName) ??
              str(profile.name) ??
              str(profile.preferred_username) ??
              str(profile.email)?.split('@')[0] ??
              sub;
            // URL handle: prefer the explicit handle/username from SSO if it's
            // already URL-safe; otherwise derive from displayName.
            const handleSeed = str(profile.preferred_username) ?? rawName;
            return {
              ssoSub: str(profile.sub),
              email,
              name: rawName,
              handle: sanitizeHandle(handleSeed, sub),
              image: str(profile.picture) ?? str(profile.avatar),
            };
          },
        },
      ],
    }),
  ],
});

export type Auth = typeof auth;

if (missing.length > 0) {
  console.warn(
    `[auth] missing env: ${missing.join(', ')} — sign-in via mozia-sso will fail until these are set in apps/api/.env. Public/anon endpoints still work.`,
  );
}
