import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { num, numOrNull } from '../common/decimal.js';
import { buildShoppingList, type ShoppingGroup } from '../domain/shopping-list.js';
import { budgetVerdict, compareBaskets, type BasketNeed } from '../domain/basket.js';
import { dayDeviation } from '../domain/day-deviation.js';
import { AI_ADVISOR, AiAdvisorUnavailableError, MEDICAL_DISCLAIMER, type AiAdvisor, type Recommendation } from '../ai/ai-advisor.js';
import { PlanContextService, type PlanRow } from './plan-context.service.js';
import type { ShoppingMarkInput } from './plans.schemas.js';

@Injectable()
export class PlanInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: PlanContextService,
    @Inject(AI_ADVISOR) private readonly advisor: AiAdvisor,
  ) {}

  async shoppingList(userId: string, planId: string): Promise<ShoppingGroup[]> {
    const plan = await this.context.plan(userId, planId);
    return this.buildList(plan);
  }

  async mark(userId: string, planId: string, ingredientId: number, input: ShoppingMarkInput) {
    const plan = await this.context.plan(userId, planId);
    const inPlan = plan.meals.some((m) => m.dish.ingredients.some((di) => di.ingredientId === ingredientId));
    if (!inPlan) {
      throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Этого продукта нет в списке покупок' });
    }
    await this.prisma.shoppingMark.upsert({
      where: { planId_ingredientId: { planId, ingredientId } },
      create: { planId, ingredientId, bought: input.bought ?? false, atHomeQty: input.atHomeQty ?? 0 },
      update: { ...(input.bought !== undefined && { bought: input.bought }), ...(input.atHomeQty !== undefined && { atHomeQty: input.atHomeQty }) },
    });
    return this.buildList(plan);
  }

  async baskets(userId: string, planId: string) {
    const plan = await this.context.plan(userId, planId);
    const groups = await this.buildList(plan);
    const needs: BasketNeed[] = groups
      .flatMap((g) => g.lines)
      .filter((l) => !l.bought && l.toBuy > 0)
      .map((l) => ({ ingredientId: l.ingredientId, name: l.name, unit: l.unit, quantity: l.toBuy }));
    const [chains, products] = await Promise.all([
      this.prisma.retailChain.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.product.findMany({ where: { ingredientId: { in: needs.map((n) => n.ingredientId) } } }),
    ]);
    const comparison = compareBaskets(
      chains.map((c) => c.code),
      needs,
      products.map((p) => ({
        chainCode: p.chainCode,
        ingredientId: p.ingredientId,
        title: p.title,
        packSize: num(p.packSize),
        packUnit: p.packUnit,
        priceRub: num(p.priceRub),
        inStock: p.inStock,
        priceUpdatedAt: p.priceUpdatedAt,
      })),
      new Date(),
    );
    const cheapestAny = [...comparison.baskets].sort((a, b) => a.totalRub - b.totalRub)[0];
    const forecast = comparison.recommended?.totalRub ?? cheapestAny?.totalRub ?? 0;
    return {
      chains: chains.map((c) => ({ code: c.code, name: c.name })),
      itemsCount: needs.length,
      ...comparison,
      budget: budgetVerdict(num(plan.budgetRub), forecast, comparison.recommended === null),
    };
  }

  async latestAnalysis(userId: string, planId: string) {
    await this.context.plan(userId, planId);
    const latest = await this.prisma.aiAnalysis.findFirst({
      where: { planId, status: 'READY' },
      orderBy: { createdAt: 'desc' },
    });
    return latest ? { createdAt: latest.createdAt, recommendations: latest.recommendations, disclaimer: MEDICAL_DISCLAIMER } : null;
  }

  async analyse(userId: string, planId: string) {
    const plan = await this.context.plan(userId, planId);
    const { norm } = await this.context.household(userId);
    const days = Array.from({ length: plan.days }, (_, dayIndex) =>
      dayDeviation(
        dayIndex,
        plan.meals
          .filter((m) => m.dayIndex === dayIndex)
          .map((m) => ({
            dishId: m.dish.id,
            dishName: m.dish.name,
            servings: num(m.servings),
            kcalPerServing: m.dish.kcalPerServing,
            proteinG: numOrNull(m.dish.proteinG),
            fatG: numOrNull(m.dish.fatG),
            carbsG: numOrNull(m.dish.carbsG),
          })),
        norm,
      ),
    );
    const catalogDishIds = new Set(plan.meals.map((m) => m.dish.id));
    let recommendations: Recommendation[];
    try {
      recommendations = await this.advisor.recommend({ norm, days, catalogDishIds: [...catalogDishIds] });
    } catch (error) {
      if (!(error instanceof AiAdvisorUnavailableError)) {
        throw error;
      }
      await this.prisma.aiAnalysis.create({ data: { planId, status: 'FAILED', recommendations: [] } });
      throw new ServiceUnavailableException({
        code: 'AI_UNAVAILABLE',
        message: 'Сервис анализа временно недоступен. Рацион не изменён, попробуйте позже.',
        retryAfterSec: 60,
      });
    }
    const safe = recommendations.filter((r) => r.dishId === null || catalogDishIds.has(r.dishId));
    const saved = await this.prisma.aiAnalysis.create({
      data: { planId, status: 'READY', recommendations: safe as unknown as object[] },
    });
    return { createdAt: saved.createdAt, days, recommendations: safe, disclaimer: MEDICAL_DISCLAIMER };
  }

  private async buildList(plan: PlanRow): Promise<ShoppingGroup[]> {
    const marks = await this.prisma.shoppingMark.findMany({ where: { planId: plan.id } });
    return buildShoppingList(
      plan.meals.map((m) => ({
        servings: num(m.servings),
        baseServings: m.dish.baseServings,
        ingredients: m.dish.ingredients.map((di) => ({
          quantity: num(di.quantity),
          unit: di.unit,
          ingredient: {
            id: di.ingredient.id,
            name: di.ingredient.name,
            category: di.ingredient.category,
            baseUnit: di.ingredient.baseUnit,
            gramsPerPiece: numOrNull(di.ingredient.gramsPerPiece),
          },
        })),
      })),
      marks.map((m) => ({ ingredientId: m.ingredientId, bought: m.bought, atHomeQty: num(m.atHomeQty) })),
    );
  }
}
