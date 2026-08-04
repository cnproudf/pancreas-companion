/**
 * The restaurant name field.
 *
 * A real label rather than a placeholder standing in for one, same reasoning as
 * FoodSearchInput: the placeholder disappears the moment she starts typing.
 *
 * The name is optional. Everything below this field works without it, because
 * most restaurants are not chains and she should never feel she has to name a
 * place before the app will help her.
 */
export function RestaurantNameInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="restaurant-name" className="text-sm text-ink">
        Where are you eating? Optional.
      </label>
      <input
        id="restaurant-name"
        type="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Olive Garden, or the diner on Main Street"
        className="w-full rounded-lg border-2 border-stone bg-paper px-4 py-3 text-ink focus:border-creek"
      />
    </div>
  )
}
