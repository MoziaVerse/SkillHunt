import { and, eq } from 'drizzle-orm';
import { db, externalIdentities, user } from '../db';
import { pseudoEmailForSsoSub, sanitizeUserHandle } from './user-identity';

const DEFAULT_SSO_PROVIDER = 'casdoor';

const userRowSelect = {
  id: user.id,
  name: user.name,
  handle: user.handle,
  email: user.email,
  image: user.image,
  ssoSub: user.ssoSub,
  phone: user.phone,
  isVirtual: user.isVirtual,
  canPublishAs: user.canPublishAs,
};

export interface SsoUserRow {
  id: string;
  name: string;
  handle: string;
  email: string;
  image: string | null;
  ssoSub: string | null;
  phone: string | null;
  isVirtual: boolean;
  canPublishAs: string[];
}

export interface ResolveSsoUserInput {
  provider?: string;
  issuer: string;
  subject: string;
  email?: string;
  name?: string;
  avatar?: string;
  phone?: string;
}

const optionalEnv = (name: string): string | null => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

const normalizeIssuer = (issuer: string) => issuer.trim().replace(/\/+$/, '');

function canonicalCasdoorIssuer(issuer: string): string {
  const normalized = normalizeIssuer(issuer);
  return normalized.replace(/\/\.well-known\/[^/]+$/, '');
}

export function identityIssuerForSso(issuer: string): string {
  const configured = optionalEnv('SKILLHUNT_SSO_IDENTITY_ISSUER');
  if (configured) return normalizeIssuer(configured);
  return canonicalCasdoorIssuer(issuer);
}

const trimText = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export function normalizeSsoPhone(value: string | undefined): string | undefined {
  const cleaned = trimText(value)?.replace(/[\s\-()]/g, '');
  if (!cleaned) return undefined;
  if (/^\+86\d{11}$/.test(cleaned)) return cleaned.slice(3);
  if (/^0086\d{11}$/.test(cleaned)) return cleaned.slice(4);
  return cleaned;
}

async function findUserByEmail(email: string): Promise<SsoUserRow | null> {
  const rows = await db.select(userRowSelect).from(user).where(eq(user.email, email)).limit(1);
  return rows[0] ?? null;
}

async function findUserByHandle(handle: string): Promise<SsoUserRow | null> {
  const rows = await db.select(userRowSelect).from(user).where(eq(user.handle, handle)).limit(1);
  return rows[0] ?? null;
}

async function findUserById(id: string): Promise<SsoUserRow | null> {
  const rows = await db.select(userRowSelect).from(user).where(eq(user.id, id)).limit(1);
  return rows[0] ?? null;
}

async function uniqueHandle(seed: string | undefined, subject: string): Promise<string> {
  const base = sanitizeUserHandle(seed, subject);
  let candidate = base;
  for (let index = 2; await findUserByHandle(candidate); index += 1) {
    const suffix = `-${index}`;
    candidate = `${base.slice(0, Math.max(1, 32 - suffix.length))}${suffix}`;
  }
  return candidate;
}

async function uniquePseudoEmailForSubject(subject: string): Promise<string> {
  const [localPart = 'sso-user', domain = 'no-email.skillhunt.local'] =
    pseudoEmailForSsoSub(subject).split('@');
  let candidate = `${localPart}@${domain}`;
  for (let index = 2; await findUserByEmail(candidate); index += 1) {
    candidate = `${localPart.slice(0, Math.max(1, 48 - String(index).length - 1))}-${index}@${domain}`;
  }
  return candidate;
}

async function findUserByExternalIdentity(input: {
  provider: string;
  issuer: string;
  subject: string;
}): Promise<SsoUserRow | null> {
  const rows = await db
    .select({ row: userRowSelect })
    .from(externalIdentities)
    .innerJoin(user, eq(externalIdentities.userId, user.id))
    .where(
      and(
        eq(externalIdentities.provider, input.provider),
        eq(externalIdentities.issuer, input.issuer),
        eq(externalIdentities.subject, input.subject),
      ),
    )
    .limit(1);
  return rows[0]?.row ?? null;
}

async function upsertExternalIdentity(input: {
  userId: string;
  provider: string;
  issuer: string;
  subject: string;
  email?: string;
  name?: string;
  avatar?: string;
}) {
  await db
    .insert(externalIdentities)
    .values({
      userId: input.userId,
      provider: input.provider,
      issuer: input.issuer,
      subject: input.subject,
      emailSnapshot: input.email,
      nameSnapshot: input.name,
      avatarSnapshot: input.avatar,
    })
    .onConflictDoUpdate({
      target: [externalIdentities.provider, externalIdentities.issuer, externalIdentities.subject],
      set: {
        userId: input.userId,
        emailSnapshot: input.email,
        nameSnapshot: input.name,
        avatarSnapshot: input.avatar,
        updatedAt: new Date(),
      },
    });
}

export async function findUserBySsoSubject(subject: string): Promise<SsoUserRow | null> {
  const issuerSeed = optionalEnv('SKILLHUNT_SSO_IDENTITY_ISSUER') ?? optionalEnv('OIDC_ISSUER');
  if (!issuerSeed) return null;
  const issuer = identityIssuerForSso(issuerSeed);

  const rows = await db
    .select({ row: userRowSelect })
    .from(externalIdentities)
    .innerJoin(user, eq(externalIdentities.userId, user.id))
    .where(
      and(
        eq(externalIdentities.provider, DEFAULT_SSO_PROVIDER),
        eq(externalIdentities.issuer, issuer),
        eq(externalIdentities.subject, subject),
      ),
    )
    .limit(1);
  return rows[0]?.row ?? null;
}

export async function resolveSsoUser(input: ResolveSsoUserInput): Promise<SsoUserRow> {
  const subject = trimText(input.subject);
  if (!subject) throw new Error('SSO subject is required');

  const provider = trimText(input.provider) ?? DEFAULT_SSO_PROVIDER;
  const issuer = identityIssuerForSso(input.issuer);
  const email = trimText(input.email);
  const name = trimText(input.name);
  const avatar = trimText(input.avatar);
  const phone = normalizeSsoPhone(input.phone);

  const existingByIdentity = await findUserByExternalIdentity({ provider, issuer, subject });
  if (existingByIdentity) {
    await upsertExternalIdentity({
      userId: existingByIdentity.id,
      provider,
      issuer,
      subject,
      email,
      name,
      avatar,
    });
    if (phone && existingByIdentity.phone !== phone) {
      await db
        .update(user)
        .set({ phone, updatedAt: new Date() })
        .where(eq(user.id, existingByIdentity.id));
      return (await findUserById(existingByIdentity.id)) ?? existingByIdentity;
    }
    return existingByIdentity;
  }

  const existingByEmail = email ? await findUserByEmail(email) : null;
  if (existingByEmail && (!existingByEmail.ssoSub || existingByEmail.ssoSub === subject)) {
    await db
      .update(user)
      .set({
        ssoSub: existingByEmail.ssoSub ?? subject,
        name: name ?? existingByEmail.name,
        image: avatar ?? existingByEmail.image,
        phone: phone ?? existingByEmail.phone,
        updatedAt: new Date(),
      })
      .where(eq(user.id, existingByEmail.id));
    await upsertExternalIdentity({
      userId: existingByEmail.id,
      provider,
      issuer,
      subject,
      email,
      name,
      avatar,
    });
    return (await findUserById(existingByEmail.id)) ?? existingByEmail;
  }

  const userEmail = email && !existingByEmail ? email : await uniquePseudoEmailForSubject(subject);
  const displayName =
    name ??
    (email?.includes('@') ? email.split('@')[0] : undefined) ??
    `用户-${subject.slice(0, 8)}`;
  const handle = await uniqueHandle(email?.split('@')[0] ?? name, subject);
  const id = crypto.randomUUID();

  await db.insert(user).values({
    id,
    name: displayName,
    handle,
    email: userEmail,
    emailVerified: Boolean(email),
    image: avatar,
    ssoSub: subject,
    phone,
  });
  await upsertExternalIdentity({
    userId: id,
    provider,
    issuer,
    subject,
    email,
    name,
    avatar,
  });

  const created = await findUserById(id);
  if (!created) throw new Error('创建用户失败');
  return created;
}
