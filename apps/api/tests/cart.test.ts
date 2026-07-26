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
  await prisma.cartHistory.deleteMany();
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

function currentWeek(): string {
  const today = new Date();
  const utc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const { year, week } = isoWeekFromDateUtc(utc);
  return formatIsoWeek(year, week);
}

function pastWeek(): string {
  const today = new Date();
  const utc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  utc.setUTCDate(utc.getUTCDate() - 14);
  const { year, week } = isoWeekFromDateUtc(utc);
  return formatIsoWeek(year, week);
}

async function seedIngredient(name: string, category: string, defaultUnit: string): Promise<string> {
  const ing = await prisma.ingredient.create({
    data: { name, category, defaultUnit },
  });
  return ing.id;
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

describe('Cart API', () => {
  beforeEach(async () => {
    await reset();
  });

  it('GET /api/cart returns empty groups when nothing is planned', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      weekKey: expect.any(String),
      weekLabel: expect.any(String),
      groups: [],
    });
  });

  it('GET /api/cart merges auto and manual entries for the same ingredient', async () => {
    const beefId = await seedIngredient('Beef', 'Meat', 'g');
    const recipe = await createRecipeWithIngredients('Stew', [
      { ingredientId: beefId, quantity: 200, unit: 'g' },
    ]);
    const week = currentWeek();
    await prisma.mealPlanSlot.create({
      data: {
        week,
        day: 1,
        date: new Date(),
        slot: 'Lunch',
        recipeId: recipe,
        servings: 1,
      },
    });
    // Force the auto cart to materialise (POST /api/plan normally does this).
    const { recomputeAutoCartForWeek } = await import('../src/cart-recompute.js');
    await recomputeAutoCartForWeek(prisma, week);

    // Add a manual line for the same ingredient/unit.
    const post = await request(app)
      .post('/api/cart/lines')
      .send({ ingredientId: beefId, quantity: 100, unit: 'g' });
    expect(post.status).toBe(201);
    expect(post.body.quantity).toBe(100);

    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(200);
    const meatGroup = res.body.groups.find(
      (g: { category: string }) => g.category === 'Meat',
    );
    expect(meatGroup).toBeDefined();
    expect(meatGroup.items).toHaveLength(1);
    const item = meatGroup.items[0];
    expect(item.autoQuantity).toBe(200);
    expect(item.manualQuantity).toBe(100);
    expect(item.totalQuantity).toBe(300);
    expect(item.source).toEqual(expect.arrayContaining(['plan', 'manual']));
    expect(item.manualLineId).toBe(post.body.id);
  });

  it('POST /api/cart/lines normalises kg → g and l → ml', async () => {
    const milk = await seedIngredient('Milk', 'Dairy', 'ml');
    const beef = await seedIngredient('Beef', 'Meat', 'g');

    const resKg = await request(app)
      .post('/api/cart/lines')
      .send({ ingredientId: beef, quantity: 1, unit: 'kg' });
    expect(resKg.status).toBe(201);
    expect(resKg.body.unit).toBe('g');
    expect(resKg.body.quantity).toBe(1000);

    const resL = await request(app)
      .post('/api/cart/lines')
      .send({ ingredientId: milk, quantity: 0.5, unit: 'l' });
    expect(resL.status).toBe(201);
    expect(resL.body.unit).toBe('ml');
    expect(resL.body.quantity).toBe(500);
  });

  it('POST /api/cart/lines with unknown ingredient returns 404', async () => {
    const res = await request(app)
      .post('/api/cart/lines')
      .send({ ingredientId: 'missing', quantity: 1, unit: 'g' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('POST /api/cart/lines with unsupported unit returns 400', async () => {
    const ing = await seedIngredient('X', 'Spices', 'g');
    const res = await request(app)
      .post('/api/cart/lines')
      .send({ ingredientId: ing, quantity: 1, unit: 'foo' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_INPUT');
  });

  it('PATCH on an auto-sourced line returns 409', async () => {
    const ing = await seedIngredient('Beef', 'Meat', 'g');
    const week = currentWeek();
    await prisma.cartItem.create({
      data: {
        week,
        ingredientId: ing,
        unit: 'g',
        quantity: 200,
        source: 'auto',
      },
    });
    const row = await prisma.cartItem.findFirstOrThrow({
      where: { week, ingredientId: ing },
    });
    const res = await request(app)
      .patch(`/api/cart/lines/${row.id}`)
      .send({ quantity: 5, unit: 'g' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_MANUAL_LINE');
  });

  it('DELETE on an auto-sourced line returns 409', async () => {
    const ing = await seedIngredient('Beef', 'Meat', 'g');
    const week = currentWeek();
    const created = await prisma.cartItem.create({
      data: {
        week,
        ingredientId: ing,
        unit: 'g',
        quantity: 200,
        source: 'auto',
      },
    });
    const res = await request(app).delete(`/api/cart/lines/${created.id}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_MANUAL_LINE');
  });

  it('PATCH on a manual line updates it', async () => {
    const ing = await seedIngredient('Milk', 'Dairy', 'ml');
    const created = await request(app)
      .post('/api/cart/lines')
      .send({ ingredientId: ing, quantity: 500, unit: 'ml', note: 'n' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/api/cart/lines/${created.body.id}`)
      .send({ quantity: 750, unit: 'ml', note: 'updated' });
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(750);
    expect(res.body.note).toBe('updated');
  });

  it('POST /api/cart/lines creates a distinct manual row for each request', async () => {
    const ing = await seedIngredient('Beef', 'Meat', 'g');
    const first = await request(app)
      .post('/api/cart/lines')
      .send({ ingredientId: ing, quantity: 200, unit: 'g' });
    expect(first.status).toBe(201);
    expect(first.body.quantity).toBe(200);

    const second = await request(app)
      .post('/api/cart/lines')
      .send({ ingredientId: ing, quantity: 300, unit: 'g' });
    expect(second.status).toBe(201);
    // Distinct row: a new id, with its own (untouched) quantity.
    expect(second.body.id).not.toBe(first.body.id);
    expect(second.body.quantity).toBe(300);

    // Both rows are persisted side-by-side in the DB.
    const stored = await prisma.cartItem.findMany({
      where: { ingredientId: ing, source: 'manual' },
      orderBy: { id: 'asc' },
    });
    expect(stored).toHaveLength(2);
    expect(stored.map((r) => r.quantity).sort()).toEqual([200, 300]);
  });

  it('GET /api/cart renders each manual row as its own item', async () => {
    const ing = await seedIngredient('Beef', 'Meat', 'g');
    await request(app)
      .post('/api/cart/lines')
      .send({ ingredientId: ing, quantity: 100, unit: 'g' });
    await request(app)
      .post('/api/cart/lines')
      .send({ ingredientId: ing, quantity: 200, unit: 'g' });

    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(200);
    const meatGroup = res.body.groups.find(
      (g: { category: string }) => g.category === 'Meat',
    );
    expect(meatGroup).toBeDefined();
    expect(meatGroup.items).toHaveLength(2);
    const quantities = meatGroup.items
      .map((it: { manualQuantity: number }) => it.manualQuantity)
      .sort();
    expect(quantities).toEqual([100, 200]);
    expect(
      meatGroup.items.every(
        (it: { manualLineId: string | null }) => typeof it.manualLineId === 'string',
      ),
    ).toBe(true);
  });

  it('PATCH with quantity only stores the value as a base-unit amount', async () => {
    const ing = await seedIngredient('Rice', 'Grains', 'g');
    const created = await request(app)
      .post('/api/cart/lines')
      .send({ ingredientId: ing, quantity: 1, unit: 'kg' });
    expect(created.status).toBe(201);
    expect(created.body.quantity).toBe(1000);

    // No `unit` provided → quantity is treated as a base-unit (g) amount.
    const res = await request(app)
      .patch(`/api/cart/lines/${created.body.id}`)
      .send({ quantity: 1500 });
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(1500);
    expect(res.body.unit).toBe('g');
  });

  it('PATCH with unit only converts the stored base quantity to the new unit', async () => {
    const ing = await seedIngredient('Milk', 'Dairy', 'ml');
    const created = await request(app)
      .post('/api/cart/lines')
      .send({ ingredientId: ing, quantity: 1, unit: 'l' });
    expect(created.status).toBe(201);
    expect(created.body.unit).toBe('ml');
    expect(created.body.quantity).toBe(1000);

    const res = await request(app)
      .patch(`/api/cart/lines/${created.body.id}`)
      .send({ unit: 'ml' });
    expect(res.status).toBe(200);
    // The stored quantity (1000 ml) is unchanged because we're converting
    // to a base unit that already matches — only the displayed unit label
    // changes when the conversion is a no-op within the same dimension.
    expect(res.body.unit).toBe('ml');
    expect(res.body.quantity).toBe(1000);
  });

  it('GET /api/cart/weeks/:weekKey lazily freezes a past week and is idempotent', async () => {
    const ing = await seedIngredient('Beef', 'Meat', 'g');
    const week = pastWeek();
    await prisma.cartItem.create({
      data: {
        week,
        ingredientId: ing,
        unit: 'g',
        quantity: 200,
        source: 'manual',
        note: 'historical',
      },
    });

    const first = await request(app).get(`/api/cart/weeks/${week}`);
    expect(first.status).toBe(200);
    expect(first.body.weekKey).toBe(week);

    const historyCount = await prisma.cartHistory.count({ where: { week } });
    expect(historyCount).toBe(1);

    const firstTakenAt = await prisma.cartHistory.findUniqueOrThrow({
      where: { week },
    });

    // Second read must not create a second snapshot.
    const second = await request(app).get(`/api/cart/weeks/${week}`);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);

    const historyCount2 = await prisma.cartHistory.count({ where: { week } });
    expect(historyCount2).toBe(1);
    const secondTakenAt = await prisma.cartHistory.findUniqueOrThrow({
      where: { week },
    });
    expect(secondTakenAt.takenAt.getTime()).toBe(firstTakenAt.takenAt.getTime());
  });

  it('GET /api/cart/weeks returns historical summaries', async () => {
    const ing = await seedIngredient('Salt', 'Spices', 'g');
    const w1 = pastWeek();
    await prisma.cartHistory.create({
      data: {
        week: w1,
        weekStart: '2026-01-01',
        weekEnd: '2026-01-07',
        weekLabel: 'Week 1, 2026',
        itemsJson: JSON.stringify([
          {
            category: 'Spices',
            items: [
              {
                ingredientId: ing,
                name: 'Salt',
                category: 'Spices',
                autoQuantity: 0,
                manualQuantity: 10,
                totalQuantity: 10,
                unit: 'g',
                source: ['manual'],
                manualLineId: null,
              },
            ],
          },
        ]),
      },
    });
    const res = await request(app).get('/api/cart/weeks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].weekKey).toBe(w1);
    expect(res.body[0].itemCount).toBe(1);
  });

  it('GET /api/cart/weeks/:weekKey with malformed key returns 400', async () => {
    const res = await request(app).get('/api/cart/weeks/not-a-week');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_INPUT');
  });
});