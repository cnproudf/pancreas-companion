import { useState } from 'react'
import { AppShell } from './components/AppShell.tsx'
import { FlareGate } from './components/FlareGate.tsx'
import { TabStrip, type TabId } from './components/TabStrip.tsx'
import { Home } from './screens/Home.tsx'
import { RestaurantHelper } from './screens/RestaurantHelper.tsx'
import { FoodLogProvider } from './state/foodLog.tsx'
import { SettingsProvider } from './state/settings.tsx'

export default function App() {
  const [tab, setTab] = useState<TabId>('food')

  return (
    <SettingsProvider>
      <FoodLogProvider>
        <AppShell>
          {/*
            Invariant 1: everything that could show food content goes inside
            FlareGate, so flare mode always reaches triage first.

            That includes the tab strip itself. Both destinations are food
            content, so in flare mode there is nothing to navigate between and
            the gate is the whole screen.
          */}
          <FlareGate>
            <TabStrip active={tab} onChange={setTab} />

            <div
              role="tabpanel"
              id={`panel-${tab}`}
              aria-labelledby={`tab-${tab}`}
              /*
                Keyed so switching tabs remounts rather than reconciling two
                different screens into each other's state.
              */
              key={tab}
            >
              {tab === 'food' ? <Home /> : <RestaurantHelper />}
            </div>
          </FlareGate>
        </AppShell>
      </FoodLogProvider>
    </SettingsProvider>
  )
}
