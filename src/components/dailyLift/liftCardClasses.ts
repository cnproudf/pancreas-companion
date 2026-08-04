/**
 * Class tables for the Daily Lift card.
 *
 * Written out as literals rather than composed at runtime, because Tailwind v4
 * purges anything it cannot see as a whole string. Same reason as the tables in
 * foodChecker/ratingClasses.ts and FatBudgetBar's TONE_CLASSES.
 */

export interface LiftScale {
  /** Size and leading for the content itself. */
  text: string
  /** Measure. Short entries get a narrower column so they still make lines. */
  measure: string
}

/*
 * Entries run from 33 to 340 characters, which is a ten to one spread. One size
 * would either shrink the one-liners into nothing or overflow the long ones off
 * a phone screen, so the size steps with length and the short ones get to be
 * big and airy. That is the whole point of the card.
 */
const LARGE: LiftScale = {
  text: 'text-[1.6rem] leading-[1.35] sm:text-[1.9rem]',
  measure: 'max-w-[26ch]',
}

const MEDIUM: LiftScale = {
  text: 'text-[1.3rem] leading-[1.45] sm:text-[1.45rem]',
  measure: 'max-w-[32ch]',
}

const SMALL: LiftScale = {
  text: 'text-[1.1rem] leading-[1.55] sm:text-[1.2rem]',
  measure: 'max-w-[38ch]',
}

export function scaleFor(content: string): LiftScale {
  if (content.length <= 95) return LARGE
  if (content.length <= 210) return MEDIUM
  return SMALL
}

/**
 * The secondary button shape from budgetBar/TodayLogPanel.tsx, retinted for the
 * sage card. Stone and paper are warm beige and read muddy on green, so the
 * border follows --moss and the fill is a plain lift off the card.
 */
export const SECONDARY_BUTTON =
  'inline-flex items-center gap-2 rounded-lg border border-moss/50 bg-white/45 px-3 py-2 text-sm text-ink hover:border-creek'
