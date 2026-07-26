import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import {
  formatIsoWeek,
  isoWeekFromDateUtc,
} from '../src/plan-utils.js';

const prisma = new PrismaClient();

async function reset(): Promise<void> {
  await prisma.cartItem.deleteMany();
  await prisma.cookLog.deleteMany();
  await prisma.mealPlanSlot.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.cartSnapshot.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.ingredient.deleteMany();
}

const app = createApp(prisma);

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

async function seedIngredient(name: string): Promise<string> {
  const ing = await prisma.ingredient.create({
    data: { name, category: 'Spices', defaultUnit: 'g' },
  });
  return ing.id;
}

function currentWeek(): string {
  const today = new Date();
  const utc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const { year, week } = isoWeekFromDateUtc(utc);
  return formatIsoWeek(year, week);
}

async function createRecipeWithIngredients(
  title: string,
  rows: Array<{ ingredientId: string; quantity: number; unit: string }>,
): Promise<string> {
  const recipe = await prisma.recipe.create({ data: { title } });
  for (const row of rows) {
    await prisma.recipeIngredient.create({
      data: {
        recipeId: recipe.id,
        ingredientId: row.ingredientId,
        quantity: row.quantity,
        unit: row.unit,
      },
    });
  }
  return recipe.id;
}

describe('Plan API', () => {
  beforeEach(async () => {
    await reset();
  });

  it('POST /api/plan creates a planned slot and returns 201', async () => {
    const recipe = await prisma.recipe.create({ data: { title: 'Soup' } });
    const week = currentWeek();
    const res = await request(app)
      .post('/api/plan')
      .send({ week, day: 2, slot: 'Lunch', recipeId: recipe.id, notes: 'n' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      day: 2,
      date: expect.any(String),
      slot: 'Lunch',
      recipeId: recipe.id,
      recipeName: 'Soup',
      notes: 'n',
      cookedCount: 0,
    });
    expect(res.headers.location).toBe(`/api/plan/${res.body.id}`);
  });

  it('POST /api/plan with unknown recipeId returns 404', async () => {
    const res = await request(app)
      .post('/api/plan')
      .send({ week: '2026-W30', day: 1, slot: 'Breakfast', recipeId: 'does-not-exist' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('POST /api/plan with invalid slot returns 400 INVALID_INPUT', async () => {
    const recipe = await prisma.recipe.create({ data: { title: 'X' } });
    const res = await request(app)
      .post('/api/plan')
      .send({ week: '2026-W30', day: 1, slot: 'Brunch', recipeId: recipe.id });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_INPUT');
    const fields = (res.body.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toContain('slot');
  });

  it('POST /api/plan with invalid day returns 400 INVALID_INPUT', async () => {
    const recipe = await prisma.recipe.create({ data: { title: 'X' } });
    const res = await request(app)
      .post('/api/plan')
      .send({ week: '2026-W30', day: 8, slot: 'Lunch', recipeId: recipe.id });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_INPUT');
  });

  it('GET /api/plan returns slots for the requested week', async () => {
    const recipe = await prisma.recipe.create({ data: { title: 'Pasta' } });
    const week = '2026-W30';
    await prisma.mealPlanSlot.create({
      data: {
        week,
        day: 3,
        date: new Date('2026-07-22T00:00:00.000Z'),
        slot: 'Dinner',
        recipeId: recipe.id,
      },
    });
    const res = await request(app).get('/api/plan').query({ week });
    expect(res.status).toBe(200);
    expect(res.body.week).toBe(week);
    expect(res.body.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.weekEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.slots).toHaveLength(1);
    expect(res.body.slots[0]).toEqual({
      id: expect.any(String),
      day: 3,
      date: '2026-07-22',
      slot: 'Dinner',
      recipeId: recipe.id,
      recipeName: 'Pasta',
      notes: null,
      cookedCount: 0,
    });
  });

  it('POST /api/plan allows multiple slots with the same label on the same day', async () => {
    const saltId = await seedIngredient('Salt');
    const milkId = await seedIngredient('Milk');
    const a = await createRecipeWithIngredients('A', [
      { ingredientId: saltId, quantity: 1, unit: 'g' },
    ]);
    const b = await createRecipeWithIngredients('B', [
      { ingredientId: milkId, quantity: 1, unit: 'ml' },
    ]);
    const week = '2026-W30';
    const r1 = await request(app)
      .post('/api/plan')
      .send({ week, day: 1, slot: 'Lunch', recipeId: a });
    expect(r1.status).toBe(201);
    const r2 = await request(app)
      .post('/api/plan')
      .send({ week, day: 1, slot: 'Lunch', recipeId: b });
    expect(r2.status).toBe(201);
    const res = await request(app).get('/api/plan').query({ week });
    expect(res.status).toBe(200);
    const lunches = res.body.slots.filter((s: { slot: string }) => s.slot === 'Lunch');
    expect(lunches).toHaveLength(2);
  });

  it('POST /api/plan/:id/cooked appends a cook log and increments cookedCount', async () => {
    const recipe = await prisma.recipe.create({ data: { title: 'Toast' } });
    const week = '2026-W30';
    const created = await request(app)
      .post('/api/plan')
      .send({ week, day: 1, slot: 'Breakfast', recipeId: recipe.id });
    const cook = await request(app).post(`/api/plan/${created.body.id}/cooked`);
    expect(cook.status).toBe(200);
    expect(cook.body.cookedCount).toBe(1);
    expect(cook.body.id).toBe(created.body.id);

    const list = await request(app).get('/api/plan').query({ week });
    const found = list.body.slots.find((s: { id: string }) => s.id === created.body.id);
    expect(found.cookedCount).toBe(1);

    const cookAgain = await request(app).post(`/api/plan/${created.body.id}/cooked`);
    expect(cookAgain.body.cookedCount).toBe(2);
  });

  it('POST /api/plan/:id/cooked persists a distinct CookLog row per click', async () => {
    const recipe = await prisma.recipe.create({ data: { title: 'Toast' } });
    const week = '2026-W30';
    const created = await request(app)
      .post('/api/plan')
      .send({ week, day: 1, slot: 'Breakfast', recipeId: recipe.id });

    expect(await prisma.cookLog.count({ where: { mealPlanSlotId: created.body.id } })).toBe(0);

    await request(app).post(`/api/plan/${created.body.id}/cooked`);
    await request(app).post(`/api/plan/${created.body.id}/cooked`);
    await request(app).post(`/api/plan/${created.body.id}/cooked`);

    const logs = await prisma.cookLog.findMany({
      where: { mealPlanSlotId: created.body.id },
      orderBy: { cookedAt: 'asc' },
    });
    const ids = logs.map((log) => log.id);
    expect(logs).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (const log of logs) {
      expect(log.recipeId).toBe(recipe.id);
      expect(log.cookedAt).toBeInstanceOf(Date);
    }
  });

  it('POST /api/plan/:id/cooked on unknown id returns 404 and creates no row', async () => {
    const before = await prisma.cookLog.count();
    const res = await request(app).post('/api/plan/does-not-exist/cooked');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(await prisma.cookLog.count()).toBe(before);
  });

  it('DELETE /api/plan/:id removes the slot and returns 204', async () => {
    const recipe = await prisma.recipe.create({ data: { title: 'Pasta' } });
    const week = '2026-W30';
    const created = await request(app)
      .post('/api/plan')
      .send({ week, day: 2, slot: 'Lunch', recipeId: recipe.id });
    const del = await request(app).delete(`/api/plan/${created.body.id}`);
    expect(del.status).toBe(204);
    const list = await request(app).get('/api/plan').query({ week });
    expect(list.body.slots).toHaveLength(0);
  });

  it('DELETE /api/plan/:id with unknown id returns 404', async () => {
    const res = await request(app).delete('/api/plan/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('GET /api/plan/stats returns counts sorted descending by times cooked within the week', async () => {
    const saltId = await seedIngredient('Salt');
    const milkId = await seedIngredient('Milk');
    const a = await createRecipeWithIngredients('A', [
      { ingredientId: saltId, quantity: 1, unit: 'g' },
    ]);
    const b = await createRecipeWithIngredients('B', [
      { ingredientId: milkId, quantity: 1, unit: 'ml' },
    ]);
    const week = '2026-W30';
    const slotA = await request(app)
      .post('/api/plan')
      .send({ week, day: 1, slot: 'Lunch', recipeId: a });
    await request(app)
      .post('/api/plan')
      .send({ week, day: 1, slot: 'Dinner', recipeId: b });
    await request(app).post(`/api/plan/${slotA.body.id}/cooked`);
    await request(app).post(`/api/plan/${slotA.body.id}/cooked`);
    const res = await request(app).get('/api/plan/stats').query({ week });
    expect(res.status).toBe(200);
    expect(res.body.items[0]).toEqual({
      recipeId: a,
      recipeName: 'A',
      count: 2,
      lastCookedAt: expect.any(String),
    });
    expect(res.body.items[1].count).toBe(0);
  });

  it('GET /api/stats returns every recipe with its lifetime count and last cooked date', async () => {
    const saltId = await seedIngredient('Salt');
    const milkId = await seedIngredient('Milk');
    const cooked = await createRecipeWithIngredients('Cooked', [
      { ingredientId: saltId, quantity: 1, unit: 'g' },
    ]);
    const fresh = await createRecipeWithIngredients('Fresh', [
      { ingredientId: milkId, quantity: 1, unit: 'ml' },
    ]);

    const week = '2026-W30';
    const slot = await request(app)
      .post('/api/plan')
      .send({ week, day: 1, slot: 'Lunch', recipeId: cooked });
    await request(app).post(`/api/plan/${slot.body.id}/cooked`);
    await request(app).post(`/api/plan/${slot.body.id}/cooked`);

    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);

    const cookedItem = res.body.items.find(
      (item: { recipeId: string; recipeName: string; count: number; lastCookedAt: string | null }) =>
        item.recipeId === cooked,
    );
    expect(cookedItem).toEqual({
      recipeId: cooked,
      recipeName: 'Cooked',
      count: 2,
      lastCookedAt: expect.any(String),
    });
    const freshItem = res.body.items.find(
      (item: { recipeId: string; recipeName: string; count: number; lastCookedAt: string | null }) =>
        item.recipeId === fresh,
    );
    expect(freshItem).toEqual({
      recipeId: fresh,
      recipeName: 'Fresh',
      count: 0,
      lastCookedAt: null,
    });
  });

  it('GET /api/plan accepts current week via week query param', async () => {
    const week = currentWeek();
    const res = await request(app).get('/api/plan').query({ week });
    expect(res.status).toBe(200);
    expect(res.body.week).toBe(week);
  });

  it('GET /api/plan with missing week defaults to the server current week', async () => {
    const res = await request(app).get('/api/plan');
    expect(res.status).toBe(200);
    expect(res.body.week).toBe(currentWeek());
  });

  it('GET /api/plan with malformed week returns 400 INVALID_WEEK', async () => {
    const res = await request(app).get('/api/plan').query({ week: 'not-a-week' });
    expect(res.status).toBe(400);
  });
});
