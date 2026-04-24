import type { Context } from 'hono';
import { verifyPat } from '../services/pat-service';
import { findUserById } from '../services/skill-service';
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
 *   1) `Authorization: Bearer mzhk_pat_*` → look up PAT, return its owner
 *   2) Otherwise, fall back to better-auth cookie session
 */
export async function getAuthContext(c: Context): Promise<AuthContext> {
  const authHeader = c.req.header('authorization') ?? c.req.header('Authorization');
  if (authHeader) {
    const match = /^Bearer\s+(mzhk_pat_[A-Za-z0-9_-]+)$/.exec(authHeader);
    const presented = match?.[1];
    if (presented) {
      const userId = await verifyPat(presented);
      if (!userId) return { user: null };
      const row = await findUserById(userId);
      if (!row) return { user: null };
      return {
        user: { id: row.id, email: row.email, name: row.name, ssoSub: null },
      };
    }
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
