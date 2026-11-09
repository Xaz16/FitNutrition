import { DAILY_KCAL_TOLERANCE, generatePlan, pickAlternatives, weekOf, type CandidateDish, type MealType } from './plan-generator.js';

function catalog(perType: number): CandidateDish[] {
  const types: Array<[MealType, number]> = [
    ['BREAKFAST', 360],
    ['LUNCH', 500],
    ['DINNER', 450],
    ['SNACK', 180],
  ];
  return types.flatMap(([mealType, kcal], t) =>
    Array.from({ length: perType }, (_, i) => ({ id: t * 100 + i, mealType, kcalPerServing: kcal + i * 5 })),
  );
}

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

describe('generatePlan (FR-05, FR-06)', () => {
  it('builds 21 meals for 7 days with 3 meals a day', () => {
    const result = generatePlan({ days: 7, mealsPerDay: 3, dailyKcalTarget: 2345, repeatLimitPerWeek: 2, dishes: catalog(8), random: seeded(1) });
    expect(result.ok && result.meals.length).toBe(21);
  });

  it('keeps every day within ±10 % of the target', () => {
    const result = generatePlan({ days: 31, mealsPerDay: 4, dailyKcalTarget: 2345, repeatLimitPerWeek: 2, dishes: catalog(8), random: seeded(2) });
    if (!result.ok) throw new Error('expected a plan');
    for (let day = 0; day < 31; day++) {
      const kcal = result.meals
        .filter((m) => m.dayIndex === day)
        .reduce((sum, m) => sum + m.servings * catalog(8).find((d) => d.id === m.dishId)!.kcalPerServing, 0);
      expect(Math.abs(kcal - 2345) / 2345).toBeLessThanOrEqual(DAILY_KCAL_TOLERANCE);
    }
  });

  it('never uses a dish more than twice in one calendar week over 14 days', () => {
    const result = generatePlan({ days: 14, mealsPerDay: 3, dailyKcalTarget: 2000, repeatLimitPerWeek: 2, dishes: catalog(8), random: seeded(3) });
    if (!result.ok) throw new Error('expected a plan');
    const counts = new Map<string, number>();
    for (const m of result.meals) {
      const key = `${weekOf(m.dayIndex)}:${m.dishId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });

  it('reports unfilled slots instead of relaxing restrictions when dishes run out', () => {
    const result = generatePlan({ days: 7, mealsPerDay: 3, dailyKcalTarget: 2000, repeatLimitPerWeek: 1, dishes: catalog(3), random: seeded(4) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.unfilled.length).toBe(12);
  });
});

describe('pickAlternatives (FR-07)', () => {
  it('offers at least 3 dishes of the same meal type within ±15 % kcal', () => {
    const pool = catalog(8);
    const current = pool.find((d) => d.id === 103)!;
    const alternatives = pickAlternatives(current, pool);
    expect(alternatives.length).toBeGreaterThanOrEqual(3);
    for (const alt of alternatives) {
      expect(alt.mealType).toBe(current.mealType);
      expect(Math.abs(alt.kcalPerServing - current.kcalPerServing) / current.kcalPerServing).toBeLessThanOrEqual(0.15);
      expect(alt.id).not.toBe(current.id);
    }
  });
});
