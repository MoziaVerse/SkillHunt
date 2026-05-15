import { afterEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db, externalIdentities, user } from '../db';
import { mapSsoProfileToUser } from './auth';
import { identityIssuerForSso } from './sso-user';
import { pseudoEmailForSsoSub } from './user-identity';

const cleanupIds = new Set<string>();
const cleanupSubs = new Set<string>();

afterEach(async () => {
  for (const id of cleanupIds) {
    await db.delete(user).where(eq(user.id, id));
  }
  for (const sub of cleanupSubs) {
    await db.delete(externalIdentities).where(eq(externalIdentities.subject, sub));
    await db.delete(user).where(eq(user.ssoSub, sub));
  }
  cleanupIds.clear();
  cleanupSubs.clear();
});

describe('mapSsoProfileToUser', () => {
  it('uses the shared pseudo email when SSO does not return email', async () => {
    const sub = `sso-no-email-${Math.random().toString(36).slice(2)}`;
    cleanupSubs.add(sub);

    const mapped = await mapSsoProfileToUser({
      sub,
      name: 'No Email User',
    });

    expect(mapped.id).toBe(sub);
    expect(mapped.email).toBe(pseudoEmailForSsoSub(sub));
    expect(mapped.name).toBe('No Email User');
    expect(mapped.emailVerified).toBe(true);
    const identities = await db
      .select()
      .from(externalIdentities)
      .where(eq(externalIdentities.subject, sub))
      .limit(1);
    expect(identities[0]?.provider).toBe('casdoor');
  });

  it('reuses an existing local user by external identity before better-auth links account', async () => {
    const sub = `sso-existing-${Math.random().toString(36).slice(2)}`;
    const id = `existing-${Math.random().toString(36).slice(2)}`;
    const email = pseudoEmailForSsoSub(sub);
    cleanupIds.add(id);
    cleanupSubs.add(sub);

    await db.insert(user).values({
      id,
      name: 'Existing SkillHunt User',
      handle: `existing-${Math.random().toString(36).slice(2)}`,
      email,
      emailVerified: false,
    });
    await db.insert(externalIdentities).values({
      userId: id,
      provider: 'casdoor',
      issuer: identityIssuerForSso(process.env.OIDC_ISSUER ?? 'http://localhost:0'),
      subject: sub,
    });

    const mapped = await mapSsoProfileToUser({
      sub,
      name: 'SSO User',
      email: 'different@example.com',
    });

    expect(mapped.id).toBe(sub);
    expect(mapped.email).toBe(email);
    expect(mapped.name).toBe('Existing SkillHunt User');
    expect(mapped.emailVerified).toBe(true);
    const identities = await db
      .select()
      .from(externalIdentities)
      .where(eq(externalIdentities.subject, sub))
      .limit(1);
    expect(identities[0]?.userId).toBe(id);
  });
});
