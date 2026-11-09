export type Unit = 'G' | 'ML' | 'PCS';

export interface IngredientInfo {
  id: number;
  name: string;
  category: string;
  baseUnit: Unit;
  gramsPerPiece: number | null;
}

export interface MealUsage {
  servings: number;
  baseServings: number;
  ingredients: Array<{ ingredient: IngredientInfo; quantity: number; unit: Unit }>;
}

export interface ShoppingMarkInfo {
  ingredientId: number;
  bought: boolean;
  atHomeQty: number;
}

export interface ShoppingLine {
  ingredientId: number;
  name: string;
  category: string;
  unit: Unit;
  required: number;
  atHome: number;
  toBuy: number;
  bought: boolean;
}

export interface ShoppingGroup {
  category: string;
  lines: ShoppingLine[];
}

function roundQty(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalize(ingredient: IngredientInfo, quantity: number, unit: Unit): { unit: Unit; quantity: number } {
  if (unit === 'PCS' && ingredient.baseUnit === 'G' && ingredient.gramsPerPiece) {
    return { unit: 'G', quantity: quantity * ingredient.gramsPerPiece };
  }
  return { unit, quantity };
}

export function buildShoppingList(meals: MealUsage[], marks: ShoppingMarkInfo[]): ShoppingGroup[] {
  const totals = new Map<string, { ingredient: IngredientInfo; unit: Unit; quantity: number }>();
  for (const meal of meals) {
    const scale = meal.servings / meal.baseServings;
    for (const line of meal.ingredients) {
      const normalized = normalize(line.ingredient, line.quantity * scale, line.unit);
      const key = `${line.ingredient.id}:${normalized.unit}`;
      const entry = totals.get(key) ?? { ingredient: line.ingredient, unit: normalized.unit, quantity: 0 };
      entry.quantity += normalized.quantity;
      totals.set(key, entry);
    }
  }

  const markById = new Map(marks.map((m) => [m.ingredientId, m]));
  const groups = new Map<string, ShoppingLine[]>();
  for (const { ingredient, unit, quantity } of totals.values()) {
    const mark = markById.get(ingredient.id);
    const appliesToThisUnit = unit === ingredient.baseUnit;
    const atHome = appliesToThisUnit ? (mark?.atHomeQty ?? 0) : 0;
    const required = roundQty(quantity);
    const line: ShoppingLine = {
      ingredientId: ingredient.id,
      name: ingredient.name,
      category: ingredient.category,
      unit,
      required,
      atHome,
      toBuy: roundQty(Math.max(0, required - atHome)),
      bought: mark?.bought ?? false,
    };
    groups.set(ingredient.category, [...(groups.get(ingredient.category) ?? []), line]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, lines]) => ({ category, lines: lines.sort((a, b) => a.name.localeCompare(b.name, 'ru')) }));
}
