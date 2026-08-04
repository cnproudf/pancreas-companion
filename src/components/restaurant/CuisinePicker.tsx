import type { Cuisine, CuisinePlaybook } from '../../types.ts'

/**
 * The cuisine chooser.
 *
 * A native select rather than a grid of chips. Fourteen chips would be two or
 * three rows of small targets on a phone, and the native control gives correct
 * keyboard and screen reader behaviour for free, plus the platform's own
 * scrolling picker on iOS and Android.
 *
 * Labels come from the data, so the UI never has to title-case a key and a
 * future cuisine can be added to the JSON without touching this file.
 */
export function CuisinePicker({
  value,
  playbooks,
  onChange,
}: {
  value: Cuisine | null
  playbooks: readonly CuisinePlaybook[]
  onChange: (value: Cuisine | null) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="cuisine-picker" className="text-sm text-ink">
        What kind of food?
      </label>
      <select
        id="cuisine-picker"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : (event.target.value as Cuisine))}
        className="w-full rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink focus:border-creek"
      >
        <option value="">Not sure yet</option>
        {playbooks.map((playbook) => (
          <option key={playbook.cuisine} value={playbook.cuisine}>
            {playbook.label}
          </option>
        ))}
      </select>
    </div>
  )
}
