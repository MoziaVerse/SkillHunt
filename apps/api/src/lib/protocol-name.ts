export const MOZIA_OWNER_HANDLE = 'mozia';

/**
 * Name exposed through /.well-known/agent-skills/index.json.
 *
 * The skills CLI validates this value as lowercase alphanumeric + hyphen only,
 * so user-owned skills cannot use `owner/slug` here. The suffix prevents
 * ambiguous joins like `a-b/c` vs `a/b-c` while keeping the name readable.
 */
export function skillProtocolName(ownerHandle: string, slug: string): string {
  return ownerHandle === MOZIA_OWNER_HANDLE
    ? slug
    : `${ownerHandle}-${slug}-${shortStableHash(`${ownerHandle}/${slug}`)}`;
}

function shortStableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}
