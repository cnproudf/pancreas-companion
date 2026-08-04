import type { ReactNode } from 'react'
import { DisclaimerFooter } from './DisclaimerFooter.tsx'
import { ModeSelector } from './ModeSelector.tsx'
import { Ridgeline } from './Ridgeline.tsx'

/**
 * Header band, main slot, persistent disclaimer footer. The mode selector lives
 * in the header so it is reachable in two taps from anywhere in the app.
 *
 * The header reads as sky above ridges: title on a pale wash, ridgelines rising
 * from the bottom of the band. Phase 5 puts the Daily Lift card in the sky,
 * above the ridge, which is where the signature image comes from.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header>
        <div className="bg-linear-to-b from-[#E4E9EC] to-paper px-5 pt-6 pb-3">
          <h1 className="m-0 text-2xl">Pancreas Companion</h1>
          <p className="mt-1 mb-0 text-sm text-ridge-mid">
            Everything you enter stays on this device.
          </p>
        </div>
        <Ridgeline variant="band" />
        <div className="bg-paper px-5 pt-5">
          <ModeSelector />
        </div>
      </header>

      <main className="flex-1 px-5 py-6">{children}</main>

      <DisclaimerFooter />
    </div>
  )
}
