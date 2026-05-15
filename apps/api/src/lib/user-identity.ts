export function sanitizeUserHandle(input: string | undefined, sub: string): string {
  const fallback = `user-${sub.slice(0, 8)}`;
  if (!input) return fallback;
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return cleaned || fallback;
}

export function pseudoEmailForSsoSub(sub: string): string {
  const localPart = sub
    .toLowerCase()
    .replace(/[^a-z0-9.!#$%&'*+/=?^_`{|}~-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${localPart || 'user'}@no-email.skillhunt.local`;
}
