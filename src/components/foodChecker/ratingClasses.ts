import type { Rating } from '../../types.ts'

/**
 * Rating colours as literal Tailwind class names.
 *
 * RatingPresentation carries fillVar and textVar as CSS variable NAMES, which
 * cannot be turned into classes at runtime: Tailwind v4 scans source for
 * literal class strings, so anything assembled from a variable gets purged and
 * the rating renders with no colour at all. Hence the lookup table.
 *
 * Yellow deliberately splits. --gold is used for the icon and the border, and
 * --gold-text for any wording, because --gold does not meet WCAG AA against
 * --paper at small sizes. That is the addendum's non-negotiable contrast rule,
 * and it is why `icon` and `text` are separate keys rather than one colour.
 */
export const RATING_CLASSES: Record<
  Rating,
  { icon: string; text: string; border: string; tint: string }
> = {
  green: {
    icon: 'text-laurel',
    text: 'text-laurel',
    border: 'border-laurel',
    tint: 'bg-laurel/5',
  },
  yellow: {
    icon: 'text-gold',
    text: 'text-gold-text',
    border: 'border-gold',
    tint: 'bg-gold/5',
  },
  red: {
    icon: 'text-clay',
    text: 'text-clay',
    border: 'border-clay',
    tint: 'bg-clay/5',
  },
}
