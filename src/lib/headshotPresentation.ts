import { practitioners } from '../content/site';

export function ownHeadshotPath(value: unknown, userId: string): string | null {
  if (typeof value !== 'string' || !value.startsWith(`${userId}/`)) return null;
  return /^[0-9a-f-]{36}\.webp$/i.test(value.slice(userId.length + 1)) ? value : null;
}

type PortraitUser = { sub: string; name: string; roles: readonly string[]; headshotPath?: string | null };
export function userPortrait(user: PortraitUser | null | undefined): { src: string; original: boolean } | null {
  if (!user) return null;
  const path = ownHeadshotPath(user.headshotPath, user.sub);
  if (path) return { src: `/api/profile/headshot?v=${encodeURIComponent(path.split('/')[1])}`, original: false };
  if (!user.roles.some(role => ['super_admin', 'support', 'employee', 'practitioner'].includes(role))) return null;
  const firstName = user.name.trim().toLowerCase().split(/[\s.@_-]+/)[0];
  const existing = practitioners.find(person => person.slug === firstName);
  return existing ? { src: existing.image, original: true } : null;
}
