import { useId } from 'react'

/**
 * Four stacked ridge silhouettes, each lighter and lower contrast than the one
 * in front, mimicking the atmospheric haze that gives the Blue Ridge its name.
 * Back to front: ridge-haze, a blend of haze and mid, ridge-mid, ridge-deep.
 *
 * Addendum section C limits this to three places: the home header band, empty
 * states at low opacity, and a thin section divider rule. Never on the food
 * checker results, the fat budget bar, or the When To Call card. Decoration on a
 * screen someone reads while unwell is a cost, not a feature.
 *
 * Redrawn in Phase 5, when this became the app's signature image. The Phase 1
 * version was four zigzag polylines; these are cubic curves with saddles
 * between the peaks, which is what real ridgelines do and what lets the four
 * layers read as distance rather than as stripes.
 */

interface RidgelineProps {
  /** 'band' for the header, 'rule' for a thin ~8px section divider. */
  variant?: 'band' | 'rule'
  /**
   * Renders the sun behind the ridges, in --gold. Addendum section C: the Daily
   * Lift card sits above the ridge like sunrise, with gold as the light source.
   * Off by default, so the empty state and divider uses stay plain.
   */
  light?: boolean
  className?: string
}

/*
 * Back to front. The blended layer sits between haze and mid, mixed by hand
 * rather than by opacity, because stacking translucent layers over the sun
 * would let the glow bleed through the silhouettes and flatten the depth.
 *
 * Each path saddles around x=190, which is where the sun sits. The light comes
 * up through the low point between two peaks, which is the whole reason the
 * ridges are drawn with saddles at all.
 */
const LAYERS = [
  {
    fill: 'var(--ridge-haze)',
    d: 'M0,34 C16,32 34,16 54,14 C74,12 96,32 112,38 C134,45 156,24 176,22 C200,20 218,32 238,36 C262,40 280,14 300,12 C330,10 366,26 400,30 L400,100 L0,100 Z',
  },
  {
    fill: '#6C8CA2',
    d: 'M0,48 C12,50 22,52 32,52 C52,52 76,34 96,32 C120,30 142,48 160,52 C182,57 202,32 222,30 C248,28 268,46 286,50 C310,55 332,38 350,36 C374,33 388,42 400,44 L400,100 L0,100 Z',
  },
  {
    fill: 'var(--ridge-mid)',
    d: 'M0,58 C14,56 30,51 44,50 C64,48 92,62 108,66 C132,71 152,48 170,46 C196,43 216,60 232,64 C258,69 274,54 290,52 C316,49 336,62 352,66 C372,70 388,68 400,66 L400,100 L0,100 Z',
  },
  {
    fill: 'var(--ridge-deep)',
    d: 'M0,80 C8,81 14,82 20,82 C42,82 62,68 80,66 C104,63 128,76 146,80 C172,85 192,66 210,64 C238,61 258,77 274,81 C300,86 322,72 340,70 C366,67 386,74 400,76 L400,100 L0,100 Z',
  },
] as const

export function Ridgeline({ variant = 'band', light = false, className = '' }: RidgelineProps) {
  // Two ridgelines on one page would otherwise share a gradient id.
  const gradientId = `ridgeline-sun-${useId()}`

  /*
   * The band grows with the viewport rather than staying at one height.
   *
   * preserveAspectRatio is "none", so the drawing stretches to whatever box it
   * is given. On a phone the box is close to the 4:1 viewBox and the ridges keep
   * their shape; on a wide desktop the same fixed height would squash them flat.
   * Growing the height keeps the distortion bounded. Slicing instead would crop
   * away the ridges entirely at desktop widths, which is worse.
   */
  const height = variant === 'rule' ? 'h-2' : 'h-28 sm:h-36 lg:h-44'

  return (
    <svg
      viewBox="0 0 400 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={`block w-full ${height} ${className}`}
    >
      {light && (
        <>
          <defs>
            <radialGradient id={gradientId} cx="0.34" cy="0.56" r="0.78">
              <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.62" />
              <stop offset="28%" stopColor="var(--gold)" stopOpacity="0.34" />
              <stop offset="58%" stopColor="var(--gold)" stopOpacity="0.13" />
              <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/*
            Drawn first, so all four ridges cover it. What stays visible is the
            glow in the sky above the silhouettes, which is what makes it read as
            light behind the mountains rather than a circle pasted on them.
          */}
          <rect x="0" y="0" width="400" height="100" fill={`url(#${gradientId})`} />
        </>
      )}

      {LAYERS.map((layer) => (
        <path key={layer.d} d={layer.d} fill={layer.fill} />
      ))}
    </svg>
  )
}
