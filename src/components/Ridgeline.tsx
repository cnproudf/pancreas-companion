/**
 * Four stacked ridge silhouettes, each lighter and lower contrast than the one
 * in front, mimicking the atmospheric haze that gives the Blue Ridge its name.
 * Back to front: ridge-haze, a blend of haze and mid, ridge-mid, ridge-deep.
 *
 * Deliberately simple for now. Phase 5 puts the Daily Lift card above this as
 * the app's signature image, and it will likely be redrawn then.
 *
 * Addendum section C limits this to three places: the home header band, empty
 * states at low opacity, and a thin section divider rule. Never on the food
 * checker results, the fat budget bar, or the When To Call card.
 */

interface RidgelineProps {
  /** 'band' for the header, 'rule' for a thin ~8px section divider. */
  variant?: 'band' | 'rule'
  className?: string
}

// Back to front. The blended layer sits between haze and mid.
const LAYERS = [
  { fill: 'var(--ridge-haze)', d: 'M0,58 L60,34 L120,50 L190,22 L260,44 L330,28 L400,46 L400,100 L0,100 Z' },
  { fill: '#6C8CA2', d: 'M0,68 L70,46 L140,62 L210,38 L280,58 L350,44 L400,60 L400,100 L0,100 Z' },
  { fill: 'var(--ridge-mid)', d: 'M0,78 L55,60 L130,76 L200,54 L275,72 L345,60 L400,74 L400,100 L0,100 Z' },
  { fill: 'var(--ridge-deep)', d: 'M0,90 L80,74 L150,88 L225,70 L300,86 L360,76 L400,88 L400,100 L0,100 Z' },
] as const

export function Ridgeline({ variant = 'band', className = '' }: RidgelineProps) {
  const height = variant === 'rule' ? 'h-2' : 'h-24'

  return (
    <svg
      viewBox="0 0 400 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={`block w-full ${height} ${className}`}
    >
      {LAYERS.map((layer) => (
        <path key={layer.d} d={layer.d} fill={layer.fill} />
      ))}
    </svg>
  )
}
