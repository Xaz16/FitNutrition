import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service.js';
import { num, numOrNull } from '../common/decimal.js';

const dishId = z.coerce.number().int().positive();
const servingsQuery = z.object({ servings: z.coerce.number().min(0.25).max(48).optional() });

@Controller()
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('allergens')
  allergens() {
    return this.prisma.allergen.findMany({ orderBy: { name: 'asc' } });
  }

  @Get('ingredients')
  async ingredients() {
    const rows = await this.prisma.ingredient.findMany({ orderBy: { name: 'asc' } });
    return rows.map((i) => ({ id: i.id, name: i.name, category: i.category, baseUnit: i.baseUnit }));
  }

  @Get('chains')
  chains() {
    return this.prisma.retailChain.findMany({ orderBy: { name: 'asc' } });
  }

  @Get('dishes/:id')
  async recipe(
    @Param('id', { schema: dishId }) id: number,
    @Query({ schema: servingsQuery }) query: z.infer<typeof servingsQuery>,
  ) {
    const dish = await this.prisma.dish.findUnique({
      where: { id },
      include: { ingredients: { include: { ingredient: { include: { allergens: true } } } } },
    });
    if (!dish) {
      throw new NotFoundException({ code: 'DISH_NOT_FOUND', message: 'Блюдо не найдено' });
    }
    const servings = query.servings ?? dish.baseServings;
    const scale = servings / dish.baseServings;
    return {
      id: dish.id,
      name: dish.name,
      mealType: dish.mealType,
      baseServings: dish.baseServings,
      servings,
      cookTimeMin: dish.cookTimeMin,
      steps: dish.steps,
      perServing: {
        kcal: dish.kcalPerServing,
        proteinG: numOrNull(dish.proteinG),
        fatG: numOrNull(dish.fatG),
        carbsG: numOrNull(dish.carbsG),
      },
      ingredients: dish.ingredients.map((di) => ({
        ingredientId: di.ingredientId,
        name: di.ingredient.name,
        unit: di.unit,
        quantity: Math.round(num(di.quantity) * scale * 10) / 10,
        allergens: di.ingredient.allergens.map((a) => a.allergenCode),
      })),
    };
  }
}
