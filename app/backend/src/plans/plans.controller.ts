import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { CurrentUserId } from '../auth/auth.guard.js';
import { PlansService } from './plans.service.js';
import { PlanInsightsService } from './plan-insights.service.js';
import {
  budgetSchema,
  createPlanSchema,
  ingredientId,
  mealId,
  planId,
  replaceMealSchema,
  shoppingMarkSchema,
  type BudgetInput,
  type CreatePlanInput,
  type ReplaceMealInput,
  type ShoppingMarkInput,
} from './plans.schemas.js';

@Controller('plans')
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly insights: PlanInsightsService,
  ) {}

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.plans.list(userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body({ schema: createPlanSchema }) body: CreatePlanInput) {
    return this.plans.create(userId, body);
  }

  @Get(':planId')
  get(@CurrentUserId() userId: string, @Param('planId', { schema: planId }) id: string) {
    return this.plans.get(userId, id);
  }

  @Delete(':planId')
  @HttpCode(204)
  remove(@CurrentUserId() userId: string, @Param('planId', { schema: planId }) id: string) {
    return this.plans.remove(userId, id);
  }

  @Put(':planId/budget')
  setBudget(
    @CurrentUserId() userId: string,
    @Param('planId', { schema: planId }) id: string,
    @Body({ schema: budgetSchema }) body: BudgetInput,
  ) {
    return this.plans.setBudget(userId, id, body);
  }

  @Get(':planId/meals/:mealId/alternatives')
  alternatives(
    @CurrentUserId() userId: string,
    @Param('planId', { schema: planId }) id: string,
    @Param('mealId', { schema: mealId }) meal: string,
  ) {
    return this.plans.alternatives(userId, id, meal);
  }

  @Put(':planId/meals/:mealId')
  replace(
    @CurrentUserId() userId: string,
    @Param('planId', { schema: planId }) id: string,
    @Param('mealId', { schema: mealId }) meal: string,
    @Body({ schema: replaceMealSchema }) body: ReplaceMealInput,
  ) {
    return this.plans.replace(userId, id, meal, body.dishId);
  }

  @Get(':planId/shopping-list')
  shoppingList(@CurrentUserId() userId: string, @Param('planId', { schema: planId }) id: string) {
    return this.insights.shoppingList(userId, id);
  }

  @Patch(':planId/shopping-list/:ingredientId')
  mark(
    @CurrentUserId() userId: string,
    @Param('planId', { schema: planId }) id: string,
    @Param('ingredientId', { schema: ingredientId }) ingredient: number,
    @Body({ schema: shoppingMarkSchema }) body: ShoppingMarkInput,
  ) {
    return this.insights.mark(userId, id, ingredient, body);
  }

  @Get(':planId/baskets')
  baskets(@CurrentUserId() userId: string, @Param('planId', { schema: planId }) id: string) {
    return this.insights.baskets(userId, id);
  }

  @Get(':planId/analysis')
  latestAnalysis(@CurrentUserId() userId: string, @Param('planId', { schema: planId }) id: string) {
    return this.insights.latestAnalysis(userId, id);
  }

  @Post(':planId/analysis')
  analyse(@CurrentUserId() userId: string, @Param('planId', { schema: planId }) id: string) {
    return this.insights.analyse(userId, id);
  }
}
