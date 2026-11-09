import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { allergens, chains, demoUser, dishes, ingredients, type IngredientSeed } from './seed-data.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function stableNoise(key: string): number {
  let hash = 0;
  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.12;
}

const WEIGHED_STEP_G = 100;
const UNIT_LABEL = { G: 'г', ML: 'мл', PCS: 'шт' } as const;

function isWeighed(i: IngredientSeed): boolean {
  return (i.category === 'VEGETABLES' || i.category === 'FRUITS') && i.unit === 'G' && i.pack >= 1000;
}

function shelfPrice(value: number, weighed: boolean): number {
  return weighed ? Math.max(1, Math.round(value * 100) / 100) : Math.max(9.99, Math.floor(value) + 0.99);
}

async function seedCatalog() {
  if ((await prisma.dish.count()) > 0) {
    console.log('Catalog already seeded, refreshing prices only');
    return;
  }
  await prisma.allergen.createMany({ data: allergens.map(([code, name]) => ({ code, name })) });

  const ingredientIds = new Map<string, number>();
  for (const i of ingredients) {
    const row = await prisma.ingredient.create({
      data: {
        name: i.name,
        category: i.category,
        baseUnit: i.unit,
        gramsPerPiece: i.gramsPerPiece ?? null,
        allergens: { create: (i.allergens ?? []).map((allergenCode) => ({ allergenCode })) },
      },
    });
    ingredientIds.set(i.name, row.id);
  }

  for (const d of dishes) {
    const kcal = d.macros ? Math.round(d.macros[0] * 4 + d.macros[1] * 9 + d.macros[2] * 4) : d.kcal!;
    await prisma.dish.create({
      data: {
        name: d.name,
        mealType: d.mealType,
        baseServings: 2,
        kcalPerServing: kcal,
        proteinG: d.macros?.[0] ?? null,
        fatG: d.macros?.[1] ?? null,
        carbsG: d.macros?.[2] ?? null,
        cookTimeMin: d.cookTimeMin,
        steps: d.steps,
        compositionComplete: d.macros !== null,
        ingredients: {
          create: d.items.map(([name, quantity, unit]) => {
            const ingredientId = ingredientIds.get(name);
            if (!ingredientId) {
              throw new Error(`Unknown ingredient "${name}" in dish "${d.name}"`);
            }
            const base = ingredients.find((i) => i.name === name)!;
            return { ingredientId, quantity, unit: unit ?? base.unit };
          }),
        },
      },
    });
  }

  console.log(`Seeded ${ingredients.length} ingredients, ${dishes.length} dishes, ${chains.length} chains`);
}

async function refreshPrices() {
  const ingredientIds = new Map((await prisma.ingredient.findMany()).map((i) => [i.name, i.id]));
  const now = Date.now();
  for (const c of chains) {
    await prisma.retailChain.upsert({ where: { code: c.code }, create: { code: c.code, name: c.name }, update: { name: c.name } });
    await prisma.product.deleteMany({ where: { chainCode: c.code, ingredient: { name: { in: c.missing } } } });
    for (const i of ingredients.filter((x) => !c.missing.includes(x.name))) {
      const weighed = isWeighed(i);
      const offer = {
        title: weighed ? `${i.name}, весовой, за 100 г` : `${i.name}, ${i.pack} ${UNIT_LABEL[i.unit]}`,
        packSize: weighed ? WEIGHED_STEP_G : i.pack,
        packUnit: i.unit,
        priceRub: shelfPrice(
          (weighed ? (i.basePriceRub * WEIGHED_STEP_G) / i.pack : i.basePriceRub) * c.priceFactor * (1 + stableNoise(`${c.code}:${i.name}`)),
          weighed,
        ),
        inStock: !c.outOfStock.includes(i.name),
        priceUpdatedAt: new Date(now - c.priceAgeHours * 3600_000),
      };
      const ingredientId = ingredientIds.get(i.name)!;
      await prisma.product.upsert({
        where: { chainCode_ingredientId: { chainCode: c.code, ingredientId } },
        create: { chainCode: c.code, ingredientId, ...offer },
        update: offer,
      });
    }
  }
  console.log(`Prices refreshed for ${chains.length} chains`);
}

async function seedDemoUser() {
  if (await prisma.user.findUnique({ where: { email: demoUser.email } })) {
    return;
  }
  await prisma.user.create({
    data: {
      email: demoUser.email,
      passwordHash: await bcrypt.hash(demoUser.password, 12),
      settings: { create: demoUser.settings },
      householdMembers: { create: { ...demoUser.member, isOwner: true } },
    },
  });
  console.log(`Demo user: ${demoUser.email} / ${demoUser.password}`);
}

try {
  await seedCatalog();
  await refreshPrices();
  await seedDemoUser();
} finally {
  await prisma.$disconnect();
}
