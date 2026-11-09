import type { DailyNorm } from './nutrition.js';

export interface DayMealNutrition {
  dishId: number;
  dishName: string;
  servings: number;
  kcalPerServing: number;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
}

export interface DayDeviation {
  dayIndex: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  kcalDeviationPct: number;
  proteinDeviationPct: number;
  fatDeviationPct: number;
  carbsDeviationPct: number;
  incompleteNutrition: boolean;
  topDish: { dishId: number; dishName: string; kcal: number } | null;
}

const pct = (actual: number, target: number) => (target === 0 ? 0 : Math.round(((actual - target) / target) * 1000) / 10);

export function dayDeviation(dayIndex: number, meals: DayMealNutrition[], norm: DailyNorm): DayDeviation {
  let kcal = 0;
  let proteinG = 0;
  let fatG = 0;
  let carbsG = 0;
  let incompleteNutrition = false;
  let topDish: DayDeviation['topDish'] = null;
  for (const m of meals) {
    const mealKcal = m.kcalPerServing * m.servings;
    kcal += mealKcal;
    if (m.proteinG === null || m.fatG === null || m.carbsG === null) {
      incompleteNutrition = true;
    } else {
      proteinG += m.proteinG * m.servings;
      fatG += m.fatG * m.servings;
      carbsG += m.carbsG * m.servings;
    }
    if (!topDish || mealKcal > topDish.kcal) {
      topDish = { dishId: m.dishId, dishName: m.dishName, kcal: Math.round(mealKcal) };
    }
  }
  return {
    dayIndex,
    kcal: Math.round(kcal),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbsG: Math.round(carbsG),
    kcalDeviationPct: pct(kcal, norm.kcal),
    proteinDeviationPct: pct(proteinG, norm.proteinG),
    fatDeviationPct: pct(fatG, norm.fatG),
    carbsDeviationPct: pct(carbsG, norm.carbsG),
    incompleteNutrition,
    topDish,
  };
}
