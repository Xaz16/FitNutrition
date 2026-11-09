import { z } from 'zod';

export const ACTIVITY_FACTORS = [1.2, 1.375, 1.55, 1.725, 1.9] as const;
export const MAX_HOUSEHOLD_PROFILES = 6;

export const memberSchema = z.object({
  name: z.string().trim().min(1, 'Укажите имя').max(60),
  sex: z.enum(['MALE', 'FEMALE'], 'Укажите пол'),
  age: z.number('Укажите возраст').int().min(14, 'Возраст должен быть от 14 до 100 лет').max(100, 'Возраст должен быть от 14 до 100 лет'),
  heightCm: z.number('Укажите рост').int().min(100, 'Рост должен быть от 100 до 250 см').max(250, 'Рост должен быть от 100 до 250 см'),
  weightKg: z.number('Укажите вес').min(30, 'Вес должен быть от 30 до 300 кг').max(300, 'Вес должен быть от 30 до 300 кг'),
  activityFactor: z
    .number()
    .refine((v) => (ACTIVITY_FACTORS as readonly number[]).includes(v), 'Выберите уровень активности из списка'),
  goal: z.enum(['LOSE', 'MAINTAIN', 'GAIN'], 'Укажите цель'),
  allergens: z.array(z.string()).max(14).default([]),
  excludedIngredientIds: z.array(z.number().int()).max(50).default([]),
});

export const profileSchema = memberSchema.extend({
  mealsPerDay: z.number().int().min(3, 'От 3 до 5 приёмов пищи').max(5, 'От 3 до 5 приёмов пищи'),
  repeatLimitPerWeek: z.number().int().min(1).max(7),
  monthlyBudgetRub: z.number('Укажите бюджет числом').positive('Бюджет должен быть больше нуля').max(1_000_000),
});

export type MemberInput = z.infer<typeof memberSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
