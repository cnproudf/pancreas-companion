import { AppShell } from './components/AppShell.tsx'
import { FlareGate } from './components/FlareGate.tsx'
import { Home } from './screens/Home.tsx'
import { SettingsProvider } from './state/settings.tsx'

export default function App() {
  return (
    <SettingsProvider>
      <AppShell>
        {/*
          Invariant 1: everything that could show food content goes inside
          FlareGate, so flare mode always reaches triage first.
        */}
        <FlareGate>
          <Home />
        </FlareGate>
      </AppShell>
    </SettingsProvider>
  )
}
