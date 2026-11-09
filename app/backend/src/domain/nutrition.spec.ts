import { dailyNorm, householdNorm, type BodyParameters } from './nutrition.js';

const fr02Example: BodyParameters = {
  sex: 'MALE',
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activityFactor: 1.55,
  goal: 'LOSE',
};

describe('dailyNorm (FR-02)', () => {
  it('matches the FR-02 acceptance example: 1780 × 1.55 × 0.85 = 2345 kcal', () => {
    expect(dailyNorm(fr02Example).kcal).toBe(2345);
  });

  it('splits macros 30/30/40 by calories: 176 g / 78 g / 235 g', () => {
    const { proteinG, fatG, carbsG } = dailyNorm(fr02Example);
    expect([proteinG, fatG, carbsG]).toEqual([176, 78, 235]);
  });
});

describe('householdNorm (FR-04)', () => {
  it('sums member norms into one daily target', () => {
    const second: BodyParameters = { sex: 'FEMALE', age: 28, heightCm: 165, weightKg: 70, activityFactor: 1.375, goal: 'MAINTAIN' };
    expect(dailyNorm(second).kcal).toBe(1967);
    expect(householdNorm([fr02Example, second]).kcal).toBe(2345 + 1967);
  });
});
