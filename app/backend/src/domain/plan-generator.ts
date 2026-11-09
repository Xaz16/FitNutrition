export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export interface CandidateDish {
  id: number;
  mealType: MealType;
  kcalPerServing: number;
}

export interface SlotPlan {
  slot: number;
  mealType: MealType;
  share: number;
}

export interface GeneratedMeal {
  dayIndex: number;
  slot: number;
  mealType: MealType;
  dishId: number;
  servings: number;
}

export interface UnfilledSlot {
  dayIndex: number;
  slot: number;
  mealType: MealType;
}

export interface GenerationRequest {
  days: number;
  mealsPerDay: number;
  dailyKcalTarget: number;
  repeatLimitPerWeek: number;
  dishes: CandidateDish[];
  random?: () => number;
}

export type GenerationResult =
  | { ok: true; meals: GeneratedMeal[] }
  | { ok: false; unfilled: UnfilledSlot[] };

export const PLAN_DAYS = { min: 7, max: 31 } as const;
export const MEALS_PER_DAY = { min: 3, max: 5 } as const;
export const SERVING_STEP = 0.25;
export const DAILY_KCAL_TOLERANCE = 0.1;
export const REPLACEMENT_KCAL_TOLERANCE = 0.15;

const SLOT_LAYOUTS: Record<number, Array<[MealType, number]>> = {
  3: [
    ['BREAKFAST', 0.3],
    ['LUNCH', 0.4],
    ['DINNER', 0.3],
  ],
  4: [
    ['BREAKFAST', 0.25],
    ['LUNCH', 0.35],
    ['SNACK', 0.1],
    ['DINNER', 0.3],
  ],
  5: [
    ['BREAKFAST', 0.25],
    ['SNACK', 0.1],
    ['LUNCH', 0.3],
    ['SNACK', 0.1],
    ['DINNER', 0.25],
  ],
};

export function slotLayout(mealsPerDay: number): SlotPlan[] {
  const layout = SLOT_LAYOUTS[mealsPerDay];
  if (!layout) {
    throw new RangeError(`mealsPerDay must be between ${MEALS_PER_DAY.min} and ${MEALS_PER_DAY.max}`);
  }
  return layout.map(([mealType, share], slot) => ({ slot, mealType, share }));
}

export function servingsFor(targetKcal: number, kcalPerServing: number): number {
  const raw = targetKcal / kcalPerServing;
  return Math.max(SERVING_STEP, Math.round(raw / SERVING_STEP) * SERVING_STEP);
}

export function weekOf(dayIndex: number): number {
  return Math.floor(dayIndex / 7);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generatePlan(req: GenerationRequest): GenerationResult {
  const random = req.random ?? Math.random;
  const layout = slotLayout(req.mealsPerDay);
  const byType = new Map<MealType, CandidateDish[]>();
  for (const dish of req.dishes) {
    byType.set(dish.mealType, [...(byType.get(dish.mealType) ?? []), dish]);
  }

  const usage = new Map<string, number>();
  const meals: GeneratedMeal[] = [];
  const unfilled: UnfilledSlot[] = [];

  for (let dayIndex = 0; dayIndex < req.days; dayIndex++) {
    const usedToday = new Set<number>();
    for (const { slot, mealType, share } of layout) {
      const key = (dishId: number) => `${weekOf(dayIndex)}:${dishId}`;
      const candidates = shuffle(byType.get(mealType) ?? [], random)
        .filter((d) => (usage.get(key(d.id)) ?? 0) < req.repeatLimitPerWeek)
        .sort((a, b) => Number(usedToday.has(a.id)) - Number(usedToday.has(b.id)));
      const dish = candidates[0];
      if (!dish) {
        unfilled.push({ dayIndex, slot, mealType });
        continue;
      }
      usage.set(key(dish.id), (usage.get(key(dish.id)) ?? 0) + 1);
      usedToday.add(dish.id);
      meals.push({
        dayIndex,
        slot,
        mealType,
        dishId: dish.id,
        servings: servingsFor(req.dailyKcalTarget * share, dish.kcalPerServing),
      });
    }
  }

  return unfilled.length > 0 ? { ok: false, unfilled } : { ok: true, meals };
}

export function pickAlternatives(
  current: CandidateDish,
  pool: CandidateDish[],
  limit = 5,
): CandidateDish[] {
  const low = current.kcalPerServing * (1 - REPLACEMENT_KCAL_TOLERANCE);
  const high = current.kcalPerServing * (1 + REPLACEMENT_KCAL_TOLERANCE);
  return pool
    .filter((d) => d.id !== current.id && d.mealType === current.mealType)
    .filter((d) => d.kcalPerServing >= low && d.kcalPerServing <= high)
    .sort(
      (a, b) =>
        Math.abs(a.kcalPerServing - current.kcalPerServing) -
        Math.abs(b.kcalPerServing - current.kcalPerServing),
    )
    .slice(0, limit);
}
