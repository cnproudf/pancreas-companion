import { formatGrams } from '../../lib/rating.ts'
import { PATTERN_COPY } from '../../lib/patterns.ts'

/**
 * The chart's key.
 *
 * The gap entry is the important one and comes first. A hatched column is the
 * only mark on the chart whose meaning is not self evident, and it is also the
 * one carrying invariant 5, so it is named explicitly rather than left to be
 * inferred from an absence.
 *
 * Each swatch is a small SVG rather than a coloured square, so the hatch reads
 * as a hatch and the hollow marker reads as hollow. Shape carries the meaning
 * alongside the colour, never colour alone.
 */
export function ChartLegend({ fatMax }: { fatMax: number | null }) {
  return (
    <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm text-ink">
      <Item swatch={<GapSwatch />}>{PATTERN_COPY.gapLegend}</Item>
      <Item swatch={<PainSwatch />}>{PATTERN_COPY.painLegend}</Item>
      <Item swatch={<SkippedSwatch />}>{PATTERN_COPY.skippedLegend}</Item>
      {fatMax !== null && (
        <Item swatch={<FatSwatch />}>
          {PATTERN_COPY.fatLegend}
          <span className="text-ridge-mid">
            {' '}
            (up to <span className="numeral">{formatGrams(fatMax)}</span>)
          </span>
        </Item>
      )}
    </ul>
  )
}

function Item({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      {swatch}
      <span>{children}</span>
    </li>
  )
}

function GapSwatch() {
  return (
    <svg width="18" height="18" aria-hidden="true" focusable="false" className="shrink-0">
      <pattern
        id="legend-hatch"
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--stone)" strokeWidth="2.5" />
      </pattern>
      <rect width="18" height="18" fill="url(#legend-hatch)" />
      <rect width="18" height="18" fill="none" stroke="var(--stone)" strokeWidth="1" />
    </svg>
  )
}

function PainSwatch() {
  return (
    <svg width="18" height="18" aria-hidden="true" focusable="false" className="shrink-0">
      <circle cx="9" cy="9" r="4.5" fill="var(--ridge-deep)" />
    </svg>
  )
}

function SkippedSwatch() {
  return (
    <svg width="18" height="18" aria-hidden="true" focusable="false" className="shrink-0">
      <circle cx="9" cy="9" r="4" fill="var(--paper)" stroke="var(--ridge-mid)" strokeWidth="2" />
    </svg>
  )
}

function FatSwatch() {
  return (
    <svg width="18" height="18" aria-hidden="true" focusable="false" className="shrink-0">
      <rect x="3" y="4" width="12" height="11" fill="var(--moss)" opacity="0.35" />
    </svg>
  )
}
