import type { Context } from 'hono';
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
 * Resolve the current request's actor from the better-auth cookie session.
 *
 * Bearer tokens (PATs) are NOT handled here — Phase 2 spec 04 will forward
 * `Authorization: Bearer ...` to matrix's central key introspect endpoint,
 * since matrix is the source of truth for keys across the Mozia ecosystem.
 */
export async function getAuthContext(c: Context): Promise<AuthContext> {
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
