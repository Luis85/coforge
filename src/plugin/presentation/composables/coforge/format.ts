import type { Category, Contributor, ContributorColor } from '../../../features/coforge/domain/types';

export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const formatTime = (value: string): string =>
  new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const initials = (name: string): string => name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CF';

/** CSS modifier for a category, e.g. `cf-category-qualityoflife`. */
export const categoryClass = (category: Category): string => `cf-category-${category.toLowerCase().replace(/[^a-z]/g, '')}`;

/** Avatar colour as an Obsidian palette token; contributors never carry raw colour literals. */
export const avatarStyle = (color: ContributorColor | undefined): Record<string, string> =>
  ({ '--cf-avatar': `var(--color-${color ?? 'purple'})` });

export const contributorName = (contributors: readonly Contributor[], id: string): string =>
  contributors.find(person => person.id === id)?.name ?? id.replace(/^[a-z]+:/, '');
