import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { num } from '../common/decimal.js';
import {
  DAILY_KCAL_TOLERANCE,
  generatePlan,
  pickAlternatives,
  servingsFor,
  type MealType,
} from '../domain/plan-generator.js';
import { isDishAllowed } from './restrictions.js';
import { PlanContextService, type PlanRow } from './plan-context.service.js';
import type { BudgetInput, CreatePlanInput } from './plans.schemas.js';

const DAY_MS = 86_400_000;

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: PlanContextService,
  ) {}

  async list(userId: string) {
    const plans = await this.prisma.mealPlan.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return plans.map((p) => ({
      id: p.id,
      startDate: p.startDate.toISOString().slice(0, 10),
      days: p.days,
      mealsPerDay: p.mealsPerDay,
      budgetRub: num(p.budgetRub),
      needsRecheck: p.needsRecheck,
      createdAt: p.createdAt,
    }));
  }

  async create(userId: string, input: CreatePlanInput) {
    const { settings, norm, restrictions } = await this.context.household(userId);
    const dishes = await this.context.allowedDishes(restrictions);
    const result = generatePlan({
      days: input.days,
      mealsPerDay: settings.mealsPerDay,
      dailyKcalTarget: norm.kcal,
      repeatLimitPerWeek: settings.repeatLimitPerWeek,
      dishes: dishes.map((d) => ({ id: d.id, mealType: d.mealType, kcalPerServing: d.kcalPerServing })),
    });
    if (!result.ok) {
      const byType = result.unfilled.reduce<Record<string, number>>((acc, u) => {
        acc[u.mealType] = (acc[u.mealType] ?? 0) + 1;
        return acc;
      }, {});
      throw new UnprocessableEntityException({
        code: 'NOT_ENOUGH_DISHES',
        message: 'Не хватает подходящих блюд для части приёмов пищи. Исключения не снимались автоматически.',
        unfilledByMealType: byType,
        unfilledCount: result.unfilled.length,
        suggestion: 'Увеличьте допустимое число повторов блюда в неделю или сократите список исключений',
      });
    }
    const budgetRub = input.budgetRub ?? Math.round((num(settings.monthlyBudgetRub) * input.days) / 30);
    const plan = await this.prisma.mealPlan.create({
      data: {
        userId,
        startDate: new Date(`${input.startDate}T00:00:00Z`),
        days: input.days,
        mealsPerDay: settings.mealsPerDay,
        dailyKcalTarget: norm.kcal,
        budgetRub,
        meals: { create: result.meals },
      },
    });
    return this.get(userId, plan.id);
  }

  async get(userId: string, planId: string) {
    const plan = await this.context.plan(userId, planId);
    const { restrictions } = await this.context.household(userId);
    const violations = plan.meals.filter((m) => !isDishAllowed(m.dish, restrictions)).map((m) => m.id);
    if (plan.needsRecheck && violations.length === 0) {
      await this.prisma.mealPlan.update({ where: { id: plan.id }, data: { needsRecheck: false } });
      plan.needsRecheck = false;
    }
    return this.view(plan, violations);
  }

  async alternatives(userId: string, planId: string, mealId: string) {
    const plan = await this.context.plan(userId, planId);
    const meal = plan.meals.find((m) => m.id === mealId);
    if (!meal) {
      throw new NotFoundException({ code: 'MEAL_NOT_FOUND', message: 'Приём пищи не найден' });
    }
    const { restrictions } = await this.context.household(userId);
    const pool = await this.context.allowedDishes(restrictions);
    const slotKcal = meal.dish.kcalPerServing * num(meal.servings);
    return pickAlternatives(
      { id: meal.dish.id, mealType: meal.mealType as MealType, kcalPerServing: meal.dish.kcalPerServing },
      pool.map((d) => ({ id: d.id, mealType: d.mealType, kcalPerServing: d.kcalPerServing })),
    ).map((alt) => {
      const dish = pool.find((d) => d.id === alt.id)!;
      const servings = servingsFor(slotKcal, dish.kcalPerServing);
      return {
        dishId: dish.id,
        name: dish.name,
        kcalPerServing: dish.kcalPerServing,
        servings,
        kcal: Math.round(servings * dish.kcalPerServing),
        cookTimeMin: dish.cookTimeMin,
      };
    });
  }

  async replace(userId: string, planId: string, mealId: string, dishId: number) {
    const options = await this.alternatives(userId, planId, mealId);
    const chosen = options.find((o) => o.dishId === dishId);
    if (!chosen) {
      throw new BadRequestException({
        code: 'REPLACEMENT_NOT_ALLOWED',
        message: 'Это блюдо нельзя поставить на выбранный приём пищи',
      });
    }
    await this.prisma.plannedMeal.update({ where: { id: mealId }, data: { dishId, servings: chosen.servings } });
    return this.get(userId, planId);
  }

  async setBudget(userId: string, planId: string, input: BudgetInput) {
    await this.context.plan(userId, planId);
    await this.prisma.mealPlan.update({ where: { id: planId }, data: { budgetRub: input.budgetRub } });
    return this.get(userId, planId);
  }

  async remove(userId: string, planId: string) {
    await this.context.plan(userId, planId);
    await this.prisma.mealPlan.delete({ where: { id: planId } });
  }

  private view(plan: PlanRow, violations: string[]) {
    const days = Array.from({ length: plan.days }, (_, dayIndex) => {
      const meals = plan.meals
        .filter((m) => m.dayIndex === dayIndex)
        .map((m) => ({
          id: m.id,
          slot: m.slot,
          mealType: m.mealType,
          servings: num(m.servings),
          kcal: Math.round(num(m.servings) * m.dish.kcalPerServing),
          dish: { id: m.dish.id, name: m.dish.name, kcalPerServing: m.dish.kcalPerServing, cookTimeMin: m.dish.cookTimeMin },
          violatesRestrictions: violations.includes(m.id),
        }));
      const kcal = meals.reduce((sum, m) => sum + m.kcal, 0);
      const deviation = (kcal - plan.dailyKcalTarget) / plan.dailyKcalTarget;
      return {
        dayIndex,
        date: addDays(plan.startDate, dayIndex),
        kcal,
        kcalDeviationPct: Math.round(deviation * 1000) / 10,
        withinTolerance: Math.abs(deviation) <= DAILY_KCAL_TOLERANCE,
        meals,
      };
    });
    return {
      id: plan.id,
      startDate: plan.startDate.toISOString().slice(0, 10),
      days: plan.days,
      mealsPerDay: plan.mealsPerDay,
      dailyKcalTarget: plan.dailyKcalTarget,
      budgetRub: num(plan.budgetRub),
      needsRecheck: plan.needsRecheck,
      violations,
      schedule: days,
    };
  }
}
