export const MOZIA_OWNER_HANDLE = 'mozia';
const MAX_PROTOCOL_NAME_LENGTH = 64;

/**
 * Name exposed through /.well-known/agent-skills/index.json.
 *
 * The skills CLI validates this value as lowercase alphanumeric + hyphen only,
 * has a 64 character limit, and rejects doubled hyphens. The suffix prevents
 * ambiguous joins like `a-b/c` vs `a/b-c` while keeping the name readable.
 */
export function skillProtocolName(ownerHandle: string, slug: string): string {
  const rawBase = ownerHandle === MOZIA_OWNER_HANDLE ? slug : `${ownerHandle}-${slug}`;
  const base = normalizeProtocolName(rawBase);
  if (ownerHandle === MOZIA_OWNER_HANDLE && rawBase === base && isValidProtocolName(base)) {
    return base;
  }

  return appendHash(base || 'skill', shortStableHash(`${ownerHandle}/${slug}`));
}

function appendHash(base: string, hash: string): string {
  const suffix = `-${hash}`;
  const maxBaseLength = MAX_PROTOCOL_NAME_LENGTH - suffix.length;
  const readable = trimHyphens(base.slice(0, maxBaseLength)) || 'skill';
  return `${readable}${suffix}`;
}

function normalizeProtocolName(input: string): string {
  return trimHyphens(
    input
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-'),
  );
}

function trimHyphens(input: string): string {
  return input.replace(/^-+|-+$/g, '');
}

function isValidProtocolName(input: string): boolean {
  return (
    input.length >= 1 &&
    input.length <= MAX_PROTOCOL_NAME_LENGTH &&
    /^[a-z0-9-]+$/.test(input) &&
    !input.startsWith('-') &&
    !input.endsWith('-') &&
    !input.includes('--')
  );
}

function shortStableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}
