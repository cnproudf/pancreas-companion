import { useState } from 'react'
import { AppShell } from './components/AppShell.tsx'
import { FlareGate } from './components/FlareGate.tsx'
import { TabStrip, type TabId } from './components/TabStrip.tsx'
import { Home } from './screens/Home.tsx'
import { Patterns } from './screens/Patterns.tsx'
import { RestaurantHelper } from './screens/RestaurantHelper.tsx'
import { Workarounds } from './screens/Workarounds.tsx'
import { FoodLogProvider } from './state/foodLog.tsx'
import { SettingsProvider } from './state/settings.tsx'
import { SymptomLogProvider } from './state/symptomLog.tsx'
import { TriageProvider } from './state/triage.tsx'

export default function App() {
  const [tab, setTab] = useState<TabId>('food')

  return (
    <SettingsProvider>
      {/*
        Inside SettingsProvider because it reads the current mode, and outside
        AppShell because two of its consumers live in the shell rather than in
        the gate: FatBudgetBar, and the symptom sheet's AttachFoodSection. Both
        render outside FlareGate and both have to agree with it exactly.
      */}
      <TriageProvider>
        <FoodLogProvider>
          {/*
            Outside AppShell, because it has consumers on BOTH sides of
            FlareGate: the sticky log bar above it and the Patterns tab inside
            it. One provider is what keeps an entry saved during a flare from
            going missing on the chart afterwards.
          */}
          <SymptomLogProvider>
            <AppShell>
              {/*
                Invariant 1: everything that could show food content goes inside
                FlareGate, so flare mode always reaches triage first.

                That includes the tab strip itself. Every destination is food
                content, so in flare mode there is nothing to navigate between
                and the gate is the whole screen.

                Patterns is food content because its chart carries logged fat
                intake and its entry list shows attached food names. Workarounds
                is food content because every card on it names a food and a gram
                value, including the ones she wrote herself. The symptom log
                sheet is not food content, which is why AppShell mounts that one
                above the gate instead.
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
                  {tab === 'food' ? (
                    <Home />
                  ) : tab === 'restaurant' ? (
                    <RestaurantHelper />
                  ) : tab === 'patterns' ? (
                    <Patterns />
                  ) : (
                    <Workarounds />
                  )}
                </div>
              </FlareGate>
            </AppShell>
          </SymptomLogProvider>
        </FoodLogProvider>
      </TriageProvider>
    </SettingsProvider>
  )
}
