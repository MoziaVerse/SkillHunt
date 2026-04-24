import type { Context } from 'hono';
import { findUserBySsoSub } from '../services/skill-service';
import { auth } from './auth';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  ssoSub: string | null;
}

export interface AuthContext {
  user: AuthUser | null;
}

/**
 * Resolve the current request's actor.
 *
 * Priority:
 *   1) `Authorization: Bearer <SKILLHUB_SERVICE_TOKEN>` + `X-SSO-SUB: <sub>` —
 *      trusted service-to-service path used by the matrix backend proxy
 *      (spec 04). The service token gates the X-SSO-SUB header; without a
 *      matching token, X-SSO-SUB is ignored entirely (no privilege escalation).
 *   2) better-auth cookie session (the normal browser path).
 *
 * Per-user PATs were intentionally walked back; central key authority lives
 * with matrix/mozia-api. Bearer auth backed by an introspect endpoint is
 * future work tracked in spec 04 §10.
 */
export async function getAuthContext(c: Context): Promise<AuthContext> {
  const serviceToken = process.env.SKILLHUB_SERVICE_TOKEN;
  const authHeader = c.req.header('authorization') ?? c.req.header('Authorization');
  if (serviceToken && authHeader === `Bearer ${serviceToken}`) {
    const sub = c.req.header('x-sso-sub');
    if (!sub) return { user: null };
    const row = await findUserBySsoSub(sub);
    if (!row) return { user: null };
    return {
      user: { id: row.id, email: row.email, name: row.name, ssoSub: sub },
    };
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return { user: null };

  const u = session.user as {
    id: string;
    email: string;
    name: string;
    ssoSub?: string | null;
  };
  return {
    user: { id: u.id, email: u.email, name: u.name, ssoSub: u.ssoSub ?? null },
  };
}
