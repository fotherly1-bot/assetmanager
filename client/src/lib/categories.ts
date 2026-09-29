import type { Category } from '../types';

/** Central map of category → emoji for consistent labels across the UI. */
export const CATEGORY_EMOJI: Record<Category, string> = {
  Vehicles: '🚐',
  'Machinery / plant': '🏗️',
  'Power tools': '🪛',
  'Hand tools': '🔨',
  'Building products': '🧱',
  Consumables: '📦',
};

export const CUSTOMER_EMOJI = '👤';

/** Label with emoji prefix, e.g. "🚐 Vehicles". Falls back to raw string. */
export function categoryLabel(category: Category | string | null | undefined): string {
  if (!category) return '—';
  const emoji = CATEGORY_EMOJI[category as Category];
  return emoji ? `${emoji} ${category}` : String(category);
}

/** Emoji alone (or empty if unknown). */
export function categoryEmoji(category: Category | string | null | undefined): string {
  if (!category) return '';
  return CATEGORY_EMOJI[category as Category] || '';
}
