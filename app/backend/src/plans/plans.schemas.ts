import { z } from 'zod';
import { PLAN_DAYS } from '../domain/plan-generator.js';

const daysMessage = `Срок рациона — от ${PLAN_DAYS.min} до ${PLAN_DAYS.max} дней`;

export const createPlanSchema = z.object({
  startDate: z.iso.date('Укажите дату начала'),
  days: z.number('Укажите срок').int().min(PLAN_DAYS.min, daysMessage).max(PLAN_DAYS.max, daysMessage),
  budgetRub: z.number('Бюджет должен быть числом').positive('Бюджет должен быть больше нуля').max(1_000_000).optional(),
});

export const replaceMealSchema = z.object({
  dishId: z.number().int().positive(),
});

export const shoppingMarkSchema = z
  .object({
    bought: z.boolean().optional(),
    atHomeQty: z.number().min(0, 'Количество не может быть отрицательным').max(100_000).optional(),
  })
  .refine((v) => v.bought !== undefined || v.atHomeQty !== undefined, 'Нечего обновлять');

export const budgetSchema = z.object({
  budgetRub: z.number('Бюджет должен быть числом').positive('Бюджет должен быть больше нуля').max(1_000_000),
});

export const planId = z.uuid();
export const mealId = z.uuid();
export const ingredientId = z.coerce.number().int().positive();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type ReplaceMealInput = z.infer<typeof replaceMealSchema>;
export type ShoppingMarkInput = z.infer<typeof shoppingMarkSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
