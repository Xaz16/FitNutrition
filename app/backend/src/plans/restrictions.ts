export interface Restrictions {
  allergens: Set<string>;
  excludedIngredientIds: Set<number>;
}

export interface DishComposition {
  compositionComplete: boolean;
  ingredients: Array<{ ingredientId: number; ingredient: { allergens: Array<{ allergenCode: string }> } }>;
}

export function collectRestrictions(
  members: Array<{ allergens: Array<{ allergenCode: string }>; exclusions: Array<{ ingredientId: number }> }>,
): Restrictions {
  return {
    allergens: new Set(members.flatMap((m) => m.allergens.map((a) => a.allergenCode))),
    excludedIngredientIds: new Set(members.flatMap((m) => m.exclusions.map((e) => e.ingredientId))),
  };
}

export function isDishAllowed(dish: DishComposition, r: Restrictions): boolean {
  if (r.allergens.size > 0 && !dish.compositionComplete) {
    return false;
  }
  return dish.ingredients.every(
    (di) =>
      !r.excludedIngredientIds.has(di.ingredientId) &&
      di.ingredient.allergens.every((a) => !r.allergens.has(a.allergenCode)),
  );
}
