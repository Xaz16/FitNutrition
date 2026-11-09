import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { num } from '../common/decimal.js';
import { dailyNorm, householdNorm, type BodyParameters } from '../domain/nutrition.js';
import { MAX_HOUSEHOLD_PROFILES, type MemberInput, type ProfileInput } from './profile.schemas.js';
import type { Prisma } from '../generated/prisma/client.js';

const memberInclude = { allergens: true, exclusions: true } satisfies Prisma.HouseholdMemberInclude;
type MemberRow = Prisma.HouseholdMemberGetPayload<{ include: typeof memberInclude }>;

export function toBody(m: MemberRow | Omit<MemberRow, 'allergens' | 'exclusions'>): BodyParameters {
  return {
    sex: m.sex,
    age: m.age,
    heightCm: m.heightCm,
    weightKg: num(m.weightKg),
    activityFactor: num(m.activityFactor),
    goal: m.goal,
  };
}

function memberView(m: MemberRow) {
  return {
    id: m.id,
    name: m.name,
    isOwner: m.isOwner,
    ...toBody(m),
    allergens: m.allergens.map((a) => a.allergenCode),
    excludedIngredientIds: m.exclusions.map((e) => e.ingredientId),
    norm: dailyNorm(toBody(m)),
  };
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const [settings, members] = await Promise.all([
      this.prisma.userSettings.findUnique({ where: { userId } }),
      this.prisma.householdMember.findMany({ where: { userId }, include: memberInclude, orderBy: [{ isOwner: 'desc' }, { name: 'asc' }] }),
    ]);
    if (!settings) {
      return null;
    }
    return {
      city: settings.city,
      mealsPerDay: settings.mealsPerDay,
      repeatLimitPerWeek: settings.repeatLimitPerWeek,
      monthlyBudgetRub: num(settings.monthlyBudgetRub),
      members: members.map(memberView),
      householdNorm: householdNorm(members.map(toBody)),
    };
  }

  async save(userId: string, input: ProfileInput) {
    await this.assertReferences(input);
    const owner = await this.prisma.householdMember.findFirst({ where: { userId, isOwner: true }, include: memberInclude });
    await this.prisma.$transaction(async (tx) => {
      await tx.userSettings.upsert({
        where: { userId },
        create: {
          userId,
          mealsPerDay: input.mealsPerDay,
          repeatLimitPerWeek: input.repeatLimitPerWeek,
          monthlyBudgetRub: input.monthlyBudgetRub,
        },
        update: {
          mealsPerDay: input.mealsPerDay,
          repeatLimitPerWeek: input.repeatLimitPerWeek,
          monthlyBudgetRub: input.monthlyBudgetRub,
        },
      });
      if (owner) {
        await this.replaceMember(tx, owner.id, input);
      } else {
        await tx.householdMember.create({ data: { userId, isOwner: true, ...this.memberData(input) } });
      }
    });
    if (owner && this.restrictionsChanged(owner, input)) {
      await this.prisma.mealPlan.updateMany({ where: { userId }, data: { needsRecheck: true } });
    }
    return this.get(userId);
  }

  async addMember(userId: string, input: MemberInput) {
    await this.assertReferences(input);
    const count = await this.prisma.householdMember.count({ where: { userId } });
    if (count === 0) {
      throw new UnprocessableEntityException({ code: 'PROFILE_REQUIRED', message: 'Сначала заполните свой профиль' });
    }
    if (count >= MAX_HOUSEHOLD_PROFILES) {
      throw new UnprocessableEntityException({
        code: 'HOUSEHOLD_LIMIT',
        message: `В семье может быть не больше ${MAX_HOUSEHOLD_PROFILES} профилей`,
      });
    }
    await this.prisma.householdMember.create({ data: { userId, ...this.memberData(input) } });
    await this.prisma.mealPlan.updateMany({ where: { userId }, data: { needsRecheck: true } });
    return this.get(userId);
  }

  async updateMember(userId: string, memberId: string, input: MemberInput) {
    await this.assertReferences(input);
    const member = await this.prisma.householdMember.findFirst({ where: { id: memberId, userId }, include: memberInclude });
    if (!member) {
      throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Член семьи не найден' });
    }
    await this.prisma.$transaction((tx) => this.replaceMember(tx, memberId, input));
    if (this.restrictionsChanged(member, input)) {
      await this.prisma.mealPlan.updateMany({ where: { userId }, data: { needsRecheck: true } });
    }
    return this.get(userId);
  }

  async removeMember(userId: string, memberId: string) {
    const member = await this.prisma.householdMember.findFirst({ where: { id: memberId, userId } });
    if (!member) {
      throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Член семьи не найден' });
    }
    if (member.isOwner) {
      throw new BadRequestException({ code: 'OWNER_REQUIRED', message: 'Свой профиль удалить нельзя' });
    }
    await this.prisma.householdMember.delete({ where: { id: memberId } });
    return this.get(userId);
  }

  private memberData(input: MemberInput) {
    return {
      name: input.name,
      sex: input.sex,
      age: input.age,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      activityFactor: input.activityFactor,
      goal: input.goal,
      allergens: { create: input.allergens.map((allergenCode) => ({ allergenCode })) },
      exclusions: { create: input.excludedIngredientIds.map((ingredientId) => ({ ingredientId })) },
    };
  }

  private async replaceMember(tx: Prisma.TransactionClient, memberId: string, input: MemberInput) {
    await tx.memberAllergen.deleteMany({ where: { memberId } });
    await tx.memberExclusion.deleteMany({ where: { memberId } });
    await tx.householdMember.update({ where: { id: memberId }, data: this.memberData(input) });
  }

  private restrictionsChanged(member: MemberRow, input: MemberInput): boolean {
    const before = [...member.allergens.map((a) => a.allergenCode), ...member.exclusions.map((e) => `i${e.ingredientId}`)].sort();
    const after = [...input.allergens, ...input.excludedIngredientIds.map((id) => `i${id}`)].sort();
    return before.join() !== after.join();
  }

  private async assertReferences(input: MemberInput) {
    const [allergens, ingredients] = await Promise.all([
      this.prisma.allergen.count({ where: { code: { in: input.allergens } } }),
      this.prisma.ingredient.count({ where: { id: { in: input.excludedIngredientIds } } }),
    ]);
    if (allergens !== new Set(input.allergens).size || ingredients !== new Set(input.excludedIngredientIds).size) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Проверьте введённые данные',
        fields: [{ field: 'allergens', message: 'Неизвестный аллерген или продукт' }],
      });
    }
  }
}
