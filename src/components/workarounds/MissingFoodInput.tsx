/**
 * The search field for the workarounds screen.
 *
 * A real label rather than a placeholder standing in for one, same as
 * FoodSearchInput, and for the same reason.
 *
 * The wording is doing work. "What are you missing?" invites a food she has
 * given up rather than one she is deciding about right now, which is the whole
 * difference between this screen and the checker.
 */
export function MissingFoodInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="workaround-search" className="text-sm text-ink">
        What are you missing?
      </label>
      <input
        id="workaround-search"
        type="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Soup beans, pimento cheese, ice cream"
        className="w-full rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink focus:border-creek"
      />
    </div>
  )
}
