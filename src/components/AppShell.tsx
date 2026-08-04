import type { ReactNode } from 'react'
import { FatBudgetBar } from './budgetBar/FatBudgetBar.tsx'
import { DailyLift } from './dailyLift/DailyLift.tsx'
import { DisclaimerFooter } from './DisclaimerFooter.tsx'
import { ModeSelector } from './ModeSelector.tsx'
import { Ridgeline } from './Ridgeline.tsx'

/**
 * Header band, main slot, persistent disclaimer footer. The mode selector lives
 * in the header so it is reachable in two taps from anywhere in the app.
 *
 * The header is the app's signature image, addendum section C: sky, the Daily
 * Lift card sitting in it, and the ridgeline below with the sun coming up
 * behind. Sunrise over the ridge. It is the first thing she sees.
 *
 * TWO THINGS LIVE OUTSIDE FlareGate, AND FOR OPPOSITE REASONS.
 *
 * FatBudgetBar is here for layout convenience and carries its own flare guard,
 * because it does show food content and must not render above triage.
 *
 * DailyLift is here on purpose. It is the one piece of the app she should still
 * see on her worst day, and it is allowed above the gate because it renders no
 * food content: no rating, no grams, no meal, no food name. That is the entire
 * justification, so it has to stay true. If the Lift ever gains food content it
 * moves inside FlareGate, signature image and all. See the longer note in
 * DailyLift.tsx, which travels with the component.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header>
        {/*
          A dawn wash rather than the flat cool grey it started as: pale sky at
          the top warming toward the horizon, so the gold sun in the ridgeline
          below has something to come up out of instead of a hard seam.
        */}
        {/*
          The sky and the ridgeline share one gradient container so there is no
          seam between them. The ridges are opaque and cover the bottom of it;
          what shows through is the sky above their crests.
        */}
        {/*
          The sun is a radial gradient on this container rather than inside the
          SVG, so the glow is continuous from the top of the sky all the way down
          to where the ridges occlude it. Put entirely inside the SVG it would
          stop dead at the SVG's top edge; the ridgeline carries a second, weaker
          copy so the light still reads through the saddles between peaks.
        */}
        <div className="bg-[radial-gradient(112%_78%_at_34%_94%,rgba(181,118,44,0.32)_0%,rgba(181,118,44,0.16)_24%,rgba(181,118,44,0.04)_50%,rgba(181,118,44,0)_68%),linear-gradient(to_bottom,#DBE3E9_0%,#E6E4DC_45%,#F1E6D5_100%)]">
          <div className="px-5 pt-5 pb-7">
            {/*
              The title is demoted to a quiet line. On this screen the Daily Lift
              is the thing with weight, and an app name in 24px serif above it
              would be competing with the only content that matters here. The h1
              stays for structure, just not for looking at.
            */}
            <p aria-hidden="true" className="m-0 text-sm font-semibold tracking-wide text-ridge-mid">
              Pancreas Companion
            </p>
            <p className="mt-0.5 mb-0 text-xs text-ridge-mid">
              Everything you enter stays on this device.
            </p>
            <h1 className="sr-only">Pancreas Companion</h1>

            <div className="mt-6">
              <DailyLift />
            </div>
          </div>

          <Ridgeline variant="band" light />
        </div>

        <div className="bg-paper px-5 pt-5">
          <ModeSelector />
        </div>
        <FatBudgetBar />
      </header>

      <main className="flex-1 px-5 py-6">{children}</main>

      <DisclaimerFooter />
    </div>
  )
}
