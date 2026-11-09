import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { validationPipe } from '../src/common/validation.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Fit Nutrition Supply API (e2e, needs seeded Postgres)', () => {
  let app: INestApplication<App>;
  let token: string;
  const email = `e2e-${Date.now()}@fitnutrition.local`;
  const profile = {
    name: 'Тест',
    sex: 'MALE',
    age: 30,
    heightCm: 180,
    weightKg: 80,
    activityFactor: 1.55,
    goal: 'LOSE',
    allergens: ['peanuts'],
    excludedIngredientIds: [],
    mealsPerDay: 3,
    repeatLimitPerWeek: 2,
    monthlyBudgetRub: 30000,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(validationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.get(PrismaService).user.deleteMany({ where: { email } });
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('rejects a short password with a field-level error (FR-01)', async () => {
    const res = await api().post('/api/auth/register').send({ email, password: '123' }).expect(400);
    expect(res.body.fields).toContainEqual(expect.objectContaining({ field: 'password' }));
  });

  it('registers, rejects a duplicate email and logs in', async () => {
    await api().post('/api/auth/register').send({ email, password: 'secret123' }).expect(201);
    await api().post('/api/auth/register').send({ email, password: 'secret123' }).expect(409);
    const res = await api().post('/api/auth/login').send({ email, password: 'secret123' }).expect(200);
    token = res.body.accessToken;
  });

  it('refuses to build a plan before the profile is filled', async () => {
    const res = await api().post('/api/plans').set(auth()).send({ startDate: '2026-11-10', days: 7 }).expect(422);
    expect(res.body.code).toBe('PROFILE_REQUIRED');
  });

  it('rejects an out-of-range age naming the field (FR-02)', async () => {
    const res = await api().put('/api/profile').set(auth()).send({ ...profile, age: 12 }).expect(400);
    expect(res.body.fields[0].field).toBe('age');
  });

  it('saves the profile and returns the FR-02 norm', async () => {
    const res = await api().put('/api/profile').set(auth()).send(profile).expect(200);
    expect(res.body.householdNorm.kcal).toBe(2345);
  });

  it('runs the main flow: plan → replace → shopping list → baskets → AI analysis', async () => {
    const plan = await api().post('/api/plans').set(auth()).send({ startDate: '2026-11-10', days: 7 }).expect(201);
    const meals = plan.body.schedule.flatMap((d: { meals: unknown[] }) => d.meals);
    expect(meals).toHaveLength(21);
    expect(plan.body.schedule.every((d: { withinTolerance: boolean }) => d.withinTolerance)).toBe(true);

    const first = plan.body.schedule[0].meals[0];
    const alternatives = await api().get(`/api/plans/${plan.body.id}/meals/${first.id}/alternatives`).set(auth()).expect(200);
    expect(alternatives.body.length).toBeGreaterThanOrEqual(3);
    expect(alternatives.body.some((a: { name: string }) => a.name.includes('арахис'))).toBe(false);

    const replaced = await api()
      .put(`/api/plans/${plan.body.id}/meals/${first.id}`)
      .set(auth())
      .send({ dishId: alternatives.body[0].dishId })
      .expect(200);
    expect(replaced.body.schedule[0].meals[0].dish.id).toBe(alternatives.body[0].dishId);

    const list = await api().get(`/api/plans/${plan.body.id}/shopping-list`).set(auth()).expect(200);
    expect(list.body.length).toBeGreaterThan(0);

    const baskets = await api().get(`/api/plans/${plan.body.id}/baskets`).set(auth()).expect(200);
    expect(baskets.body.baskets).toHaveLength(5);
    expect(baskets.body.budget.budgetRub).toBe(7000);

    const analysis = await api().post(`/api/plans/${plan.body.id}/analysis`).set(auth()).expect(201);
    expect(analysis.body.recommendations.length).toBeGreaterThanOrEqual(3);
    expect(analysis.body.disclaimer).toContain('не являются медицинскими');
  });
});
