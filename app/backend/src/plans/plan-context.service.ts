import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { householdNorm } from '../domain/nutrition.js';
import { toBody } from '../profile/profile.service.js';
import { collectRestrictions, isDishAllowed, type Restrictions } from './restrictions.js';
import type { Prisma } from '../generated/prisma/client.js';

export const dishWithComposition = {
  ingredients: { include: { ingredient: { include: { allergens: true } } } },
} satisfies Prisma.DishInclude;

export type DishRow = Prisma.DishGetPayload<{ include: typeof dishWithComposition }>;

export const planWithMeals = {
  meals: { include: { dish: { include: dishWithComposition } }, orderBy: [{ dayIndex: 'asc' }, { slot: 'asc' }] },
} satisfies Prisma.MealPlanInclude;

export type PlanRow = Prisma.MealPlanGetPayload<{ include: typeof planWithMeals }>;

@Injectable()
export class PlanContextService {
  constructor(private readonly prisma: PrismaService) {}

  async household(userId: string) {
    const [settings, members] = await Promise.all([
      this.prisma.userSettings.findUnique({ where: { userId } }),
      this.prisma.householdMember.findMany({ where: { userId }, include: { allergens: true, exclusions: true } }),
    ]);
    if (!settings || members.length === 0) {
      throw new UnprocessableEntityException({ code: 'PROFILE_REQUIRED', message: 'Сначала заполните профиль' });
    }
    return {
      settings,
      members,
      norm: householdNorm(members.map(toBody)),
      restrictions: collectRestrictions(members),
    };
  }

  async allowedDishes(restrictions: Restrictions): Promise<DishRow[]> {
    const dishes = await this.prisma.dish.findMany({ include: dishWithComposition });
    return dishes.filter((d) => isDishAllowed(d, restrictions));
  }

  async plan(userId: string, planId: string): Promise<PlanRow> {
    const plan = await this.prisma.mealPlan.findFirst({ where: { id: planId, userId }, include: planWithMeals });
    if (!plan) {
      throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Рацион не найден' });
    }
    return plan;
  }
}
