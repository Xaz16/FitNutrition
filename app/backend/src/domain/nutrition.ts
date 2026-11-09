export type Sex = 'MALE' | 'FEMALE';
export type Goal = 'LOSE' | 'MAINTAIN' | 'GAIN';

export interface BodyParameters {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityFactor: number;
  goal: Goal;
}

export interface DailyNorm {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export const GOAL_FACTOR: Record<Goal, number> = {
  LOSE: 0.85,
  MAINTAIN: 1,
  GAIN: 1.15,
};

export const MACRO_SHARE = { protein: 0.3, fat: 0.3, carbs: 0.4 } as const;

const KCAL_PER_GRAM = { protein: 4, fat: 9, carbs: 4 } as const;

export function basalMetabolicRate(p: BodyParameters): number {
  const sexOffset = p.sex === 'MALE' ? 5 : -161;
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + sexOffset;
}

export function dailyNorm(p: BodyParameters): DailyNorm {
  const kcal = Math.round(basalMetabolicRate(p) * p.activityFactor * GOAL_FACTOR[p.goal]);
  return {
    kcal,
    proteinG: Math.round((kcal * MACRO_SHARE.protein) / KCAL_PER_GRAM.protein),
    fatG: Math.round((kcal * MACRO_SHARE.fat) / KCAL_PER_GRAM.fat),
    carbsG: Math.round((kcal * MACRO_SHARE.carbs) / KCAL_PER_GRAM.carbs),
  };
}

export function householdNorm(members: BodyParameters[]): DailyNorm {
  return members.map(dailyNorm).reduce(
    (sum, n) => ({
      kcal: sum.kcal + n.kcal,
      proteinG: sum.proteinG + n.proteinG,
      fatG: sum.fatG + n.fatG,
      carbsG: sum.carbsG + n.carbsG,
    }),
    { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 },
  );
}
