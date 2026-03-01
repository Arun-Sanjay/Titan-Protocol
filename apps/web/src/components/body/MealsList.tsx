import type { BodyMealRecord } from "../../lib/db";

type MealsListProps = {
  meals: BodyMealRecord[];
  saving: boolean;
  onEdit: (meal: BodyMealRecord) => void;
  onDelete: (id: number) => void;
};

export function MealsList({ meals, saving, onEdit, onDelete }: MealsListProps) {
  if (meals.length === 0) {
    return <p className="text-sm text-white/65">No meals logged for this date.</p>;
  }

  return (
    <div className="space-y-2">
      {meals.map((meal) => (
        <article
          key={meal.id}
          className="chrome-outline flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-3"
        >
          <div>
            <p className="text-sm font-semibold text-white">{meal.name}</p>
            <p className="text-xs text-white/65">
              {meal.calories} kcal • P {meal.protein ?? "—"} • C {meal.carbs ?? "—"} • F {meal.fat ?? "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="hud-btn px-2 py-1 text-xs text-white"
              onClick={() => onEdit(meal)}
              disabled={saving}
            >
              Edit
            </button>
            <button
              type="button"
              className="hud-btn px-2 py-1 text-xs text-white"
              onClick={() => meal.id && onDelete(meal.id)}
              disabled={saving}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
