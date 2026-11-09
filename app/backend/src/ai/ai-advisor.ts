import type { DayDeviation } from '../domain/day-deviation.js';
import type { DailyNorm } from '../domain/nutrition.js';

export interface Recommendation {
  dayIndex: number;
  dishId: number | null;
  text: string;
}

export interface AdvisorInput {
  norm: DailyNorm;
  days: DayDeviation[];
  catalogDishIds: number[];
}

export const AI_ADVISOR = Symbol('AI_ADVISOR');

export interface AiAdvisor {
  recommend(input: AdvisorInput): Promise<Recommendation[]>;
}

export class AiAdvisorUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'AiAdvisorUnavailableError';
  }
}

export const MEDICAL_DISCLAIMER =
  'Рекомендации носят информационный характер и не являются медицинскими. При заболеваниях проконсультируйтесь со специалистом.';
