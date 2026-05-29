import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth } from 'better-auth/plugins';
import { db } from '../db';
import { account, session, user, verification } from '../db/auth-schema';
import { resolveSsoUser } from './sso-user';

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

const resolveAuthBaseUrl = () => {
  const configured = cfg('BETTER_AUTH_URL');
  const port = process.env.PORT;
  if (!port) return configured;
  try {
    const url = new URL(configured);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.port = port;
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    return configured;
  }
  return configured;
};

const authBaseURL = resolveAuthBaseUrl();

const localWebOrigins = [
  process.env.WEB_ORIGIN,
  'http://localhost:5173',
  'http://localhost:5180',
  'http://localhost:5181',
].filter((origin): origin is string => Boolean(origin));

// Vite dev origin proxies /api → :3333, so the request's Origin header is
// the web app origin while baseURL points at the API. Allowlist both, plus
// anything in TRUSTED_ORIGINS (comma-separated, for prod hosts).
const trustedOrigins = [
  authBaseURL,
  ...localWebOrigins,
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

const phoneFromProfile = (profile: Record<string, unknown>) =>
  str(profile.phone) ?? str(profile.phone_number) ?? str(profile.mobile);

export async function mapSsoProfileToUser(profile: Record<string, unknown>) {
  const sub = str(profile.sub) ?? str(profile.id) ?? 'unknown';
  const rawName =
    str(profile.displayName) ??
    str(profile.name) ??
    str(profile.preferred_username) ??
    str(profile.email)?.split('@')[0] ??
    sub;
  const image = str(profile.picture) ?? str(profile.avatar);
  const phone = phoneFromProfile(profile);
  const row = await resolveSsoUser({
    provider: 'casdoor',
    issuer: cfg('OIDC_ISSUER'),
    subject: sub,
    email: str(profile.email),
    name: rawName,
    avatar: image,
    phone,
  });

  return {
    id: sub,
    ssoSub: row.ssoSub ?? sub,
    email: row.email,
    name: row.name,
    handle: row.handle,
    emailVerified: true,
    image: row.image ?? image,
    phone: row.phone,
  };
}

export const auth = betterAuth({
  baseURL: authBaseURL,
  secret: cfg('BETTER_AUTH_SECRET'),
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: { user, session, account, verification },
  }),
  account: {
    accountLinking: {
      trustedProviders: [OIDC_PROVIDER_ID],
    },
  },
  user: {
    additionalFields: {
      ssoSub: { type: 'string', required: false },
      handle: { type: 'string', required: false, input: false },
      phone: { type: 'string', required: false, input: false },
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
          scopes: ['openid', 'profile', 'email', 'phone'],
          mapProfileToUser: mapSsoProfileToUser,
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
