import { useId } from 'react'
import { buildMarks } from '../../lib/chartGeometry.ts'
import { PATTERN_COPY, type PatternWindow } from '../../lib/patterns.ts'
import { ChartDataTable } from './ChartDataTable.tsx'

/**
 * The pattern chart. Addendum section B: "Plot logged symptom events as discrete
 * points on a timeline, with daily logged fat intake as a light background
 * series. Not a continuous daily line, because the data is not continuous."
 *
 * This component does no arithmetic. Every position comes from
 * chartGeometry.buildMarks, which is a pure module with its own suite, because
 * invariant 5 is a claim about geometry and a claim about geometry should be
 * testable without a DOM.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO:
 *
 * There is no <path>, no polyline, and no line series anywhere below. Symptom
 * events are discrete points, so there is nothing that could interpolate across
 * a day she did not log. If someone ever adds a trend line here, it will draw
 * straight through her gaps and assert data that does not exist.
 *
 * Days with nothing logged are DRAWN, as a hatched column, rather than left
 * blank. White space on a chart reads as "nothing happened", and an unlogged day
 * is unknown, not calm. The hatch is a pattern rather than a tint so it does not
 * rest on colour alone, which is invariant 8's principle applied to a chart.
 *
 * Addendum section C bars the ridgeline motif from screens read while unwell.
 * This is one of them, so there is no decoration here at all.
 *
 * The SVG is aria-hidden and ChartDataTable carries the same window in a real
 * table, where an unlogged day is a row reading "no entry" rather than a row
 * that is missing. The gap rule holds in the screen reader path too.
 */
export function PatternChart({ window }: { window: PatternWindow }) {
  const marks = buildMarks(window)
  // Two charts on one page would otherwise share a pattern id.
  const hatchId = `pattern-gap-${useId()}`

  if (marks.columns.length === 0) return null

  const { axis, box } = marks

  return (
    <div>
      <svg
        viewBox={`0 0 ${box.width} ${box.height}`}
        aria-hidden="true"
        focusable="false"
        className="block w-full"
      >
        <defs>
          <pattern
            id={hatchId}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--stone)" strokeWidth="2.5" />
          </pattern>
        </defs>

        {/*
          Gaps first, behind everything. One per calendar day with nothing
          logged at all. A day with food but no symptom entry is not hatched:
          its bar already shows the day was not empty.
        */}
        {marks.gaps.map((gap) => (
          <rect
            key={gap.dateKey}
            x={gap.x}
            y={gap.y}
            width={gap.width}
            height={gap.height}
            fill={`url(#${hatchId})`}
            opacity="0.5"
          />
        ))}

        {/* Fat, the light background series. No bar at all on days with no food. */}
        {marks.fatBars.map((bar) => (
          <rect
            key={bar.dateKey}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            fill="var(--moss)"
            opacity="0.35"
          />
        ))}

        {/* Pain gridlines, behind the points. */}
        {axis.painTicks.map((tick) => (
          <g key={tick.pain}>
            <line
              x1={axis.plotLeft}
              y1={tick.y}
              x2={axis.plotRight}
              y2={tick.y}
              stroke="var(--stone)"
              strokeWidth="1"
            />
            <text
              x={axis.plotLeft - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="numeral"
              fontSize="12"
              fill="var(--ridge-mid)"
            >
              {tick.pain}
            </text>
          </g>
        ))}

        {/*
          The rule under the pain band. Everything below it is outside the 0 to
          10 scale, which is what lets the skipped strip exist without borrowing
          the zero line.
        */}
        <line
          x1={axis.plotLeft}
          y1={axis.ruleY}
          x2={axis.plotRight}
          y2={axis.ruleY}
          stroke="var(--ridge-mid)"
          strokeWidth="1.5"
        />

        {/*
          Logged days carrying no pain number. Hollow, in the strip below the
          rule, never at y(0). The 0 gridline is taken by a real observation.
        */}
        {marks.skippedPoints.map((point) => (
          <circle
            key={point.dateKey}
            cx={point.cx}
            cy={point.cy}
            r="4"
            fill="var(--paper)"
            stroke="var(--ridge-mid)"
            strokeWidth="2"
          />
        ))}

        {/* Pain she logged. Discrete, unconnected. */}
        {marks.painPoints.map((point) => (
          <circle
            key={point.dateKey}
            cx={point.cx}
            cy={point.cy}
            r={point.eventCount > 1 ? 6 : 4.5}
            fill="var(--ridge-deep)"
          />
        ))}

        {marks.dayLabels.map((label) => (
          <text
            key={label.dateKey}
            x={label.x}
            y={box.height - 8}
            textAnchor="middle"
            fontSize="12"
            fill="var(--ridge-mid)"
          >
            {label.text}
          </text>
        ))}
      </svg>

      {/*
        The sentence that keeps the chart honest. It says what an empty column
        is and, just as importantly, what it is not.
      */}
      <p className="mt-3 mb-0 text-sm text-ink">{PATTERN_COPY.gapExplainer}</p>

      <ChartDataTable window={window} />
    </div>
  )
}
