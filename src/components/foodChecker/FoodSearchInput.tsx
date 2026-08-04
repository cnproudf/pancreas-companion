/**
 * The search field. One job, so the screen can stay readable.
 *
 * A real label, not a placeholder standing in for one: a placeholder vanishes
 * the moment she starts typing, which is exactly when someone checking a food
 * one-handed at a restaurant table might need to be reminded what the field is.
 */
export function FoodSearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="food-search" className="text-sm text-ink">
        What are you thinking about eating?
      </label>
      <input
        id="food-search"
        type="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Grilled chicken, peanut butter, a beer"
        className="w-full rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink focus:border-creek"
      />
    </div>
  )
}
