import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';

const prisma = new PrismaClient();

async function reset(): Promise<void> {
  await prisma.recipeIngredient.deleteMany();
  await prisma.cookLog.deleteMany();
  await prisma.cartSnapshot.deleteMany();
  await prisma.mealPlanSlot.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.ingredient.deleteMany();
}

const app = createApp(prisma);

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

describe('Recipes API', () => {
  beforeEach(async () => {
    await reset();
  });

  async function seedIngredients(): Promise<{ salt: string; milk: string; tomato: string }> {
    const salt = await prisma.ingredient.create({
      data: { name: 'Salt', category: 'Spices', defaultUnit: 'g' },
    });
    const milk = await prisma.ingredient.create({
      data: { name: 'Milk', category: 'Dairy', defaultUnit: 'ml' },
    });
    const tomato = await prisma.ingredient.create({
      data: { name: 'Tomato', category: 'Vegetables', defaultUnit: 'pcs' },
    });
    return { salt: salt.id, milk: milk.id, tomato: tomato.id };
  }

  it('GET /api/recipes returns [] when empty', async () => {
    const res = await request(app).get('/api/recipes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/recipes creates a recipe with ingredients and returns 201 with Location', async () => {
    const ids = await seedIngredients();
    const res = await request(app)
      .post('/api/recipes')
      .send({
        name: 'Tomato Soup',
        ingredients: [
          { ingredientId: ids.tomato, quantity: 2, unit: 'pcs' },
          { ingredientId: ids.salt, quantity: 0.5, unit: 'g' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      name: 'Tomato Soup',
      ingredients: [
        { ingredientId: ids.tomato, ingredientName: 'Tomato', quantity: 2, unit: 'pcs' },
        { ingredientId: ids.salt, ingredientName: 'Salt', quantity: 0.5, unit: 'g' },
      ],
      timesCooked: 0,
    });
    expect(res.headers.location).toBe(`/api/recipes/${res.body.id}`);
  });

  it('GET /api/recipes lists recipes and surfaces timesCooked from CookLogs', async () => {
    const ids = await seedIngredients();
    const created = await prisma.recipe.create({
      data: { title: 'Salt Water', servings: 1 },
    });
    await prisma.cookLog.createMany({
      data: [
        { recipeId: created.id },
        { recipeId: created.id },
        { recipeId: created.id },
      ],
    });
    await request(app)
      .post('/api/recipes')
      .send({
        name: 'Milk Drink',
        ingredients: [{ ingredientId: ids.milk, quantity: 200, unit: 'ml' }],
      });
    const res = await request(app).get('/api/recipes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const saltWater = res.body.find((r: { name: string }) => r.name === 'Salt Water');
    expect(saltWater.timesCooked).toBe(3);
    const milkDrink = res.body.find((r: { name: string }) => r.name === 'Milk Drink');
    expect(milkDrink.timesCooked).toBe(0);
  });

  it('GET /api/recipes/:id returns the recipe or 404', async () => {
    const ids = await seedIngredients();
    const created = await request(app)
      .post('/api/recipes')
      .send({
        name: 'Milk Drink',
        ingredients: [{ ingredientId: ids.milk, quantity: 100, unit: 'ml' }],
      });
    const ok = await request(app).get(`/api/recipes/${created.body.id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe('Milk Drink');
    const missing = await request(app).get('/api/recipes/does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('NOT_FOUND');
  });

  it('POST /api/recipes with empty name returns 400 with details on name', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .send({ name: '   ', ingredients: [] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_INPUT');
    const fields = (res.body.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toContain('name');
  });

  it('POST /api/recipes with unknown ingredientId returns 400 with index in details', async () => {
    const ids = await seedIngredients();
    const res = await request(app)
      .post('/api/recipes')
      .send({
        name: 'Mixed',
        ingredients: [
          { ingredientId: ids.salt, quantity: 1, unit: 'g' },
          { ingredientId: 'missing', quantity: 1, unit: 'g' },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_INPUT');
    const fields = (res.body.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toContain('ingredients.1.ingredientId');
  });

  it('POST /api/recipes with invalid unit returns 400 with details on the offending row', async () => {
    const ids = await seedIngredients();
    const res = await request(app)
      .post('/api/recipes')
      .send({
        name: 'Bad',
        ingredients: [{ ingredientId: ids.salt, quantity: 1, unit: 'kg' }],
      });
    expect(res.status).toBe(400);
    const fields = (res.body.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toContain('ingredients.0.unit');
  });

  it('POST /api/recipes with quantity <= 0 returns 400 with details on the offending row', async () => {
    const ids = await seedIngredients();
    const res = await request(app)
      .post('/api/recipes')
      .send({
        name: 'Bad',
        ingredients: [{ ingredientId: ids.salt, quantity: 0, unit: 'g' }],
      });
    expect(res.status).toBe(400);
    const fields = (res.body.details as Array<{ field: string }>).map((d) => d.field);
    expect(fields).toContain('ingredients.0.quantity');
  });

  it('PATCH /api/recipes/:id updates only the name', async () => {
    const ids = await seedIngredients();
    const created = await request(app)
      .post('/api/recipes')
      .send({
        name: 'Old Name',
        ingredients: [{ ingredientId: ids.salt, quantity: 1, unit: 'g' }],
      });
    const res = await request(app)
      .patch(`/api/recipes/${created.body.id}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.ingredients).toHaveLength(1);
  });

  it('PATCH /api/recipes/:id replaces the full ingredient list in one operation', async () => {
    const ids = await seedIngredients();
    const created = await request(app)
      .post('/api/recipes')
      .send({
        name: 'Swap',
        ingredients: [{ ingredientId: ids.salt, quantity: 1, unit: 'g' }],
      });
    const res = await request(app)
      .patch(`/api/recipes/${created.body.id}`)
      .send({
        ingredients: [
          { ingredientId: ids.milk, quantity: 50, unit: 'ml' },
          { ingredientId: ids.tomato, quantity: 1, unit: 'pcs' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.ingredients.map((i: { ingredientId: string }) => i.ingredientId))
      .toEqual([ids.milk, ids.tomato]);
  });

  it('PATCH /api/recipes/:id with unknown id returns 404', async () => {
    const res = await request(app)
      .patch('/api/recipes/does-not-exist')
      .send({ name: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('DELETE /api/recipes/:id returns 204 and cascades to ingredient rows', async () => {
    const ids = await seedIngredients();
    const created = await request(app)
      .post('/api/recipes')
      .send({
        name: 'To Delete',
        ingredients: [{ ingredientId: ids.salt, quantity: 1, unit: 'g' }],
      });
    const recipeId = created.body.id;
    const before = await prisma.recipeIngredient.count({ where: { recipeId } });
    expect(before).toBe(1);
    const del = await request(app).delete(`/api/recipes/${recipeId}`);
    expect(del.status).toBe(204);
    const after = await prisma.recipeIngredient.count({ where: { recipeId } });
    expect(after).toBe(0);
    const follow = await request(app).get(`/api/recipes/${recipeId}`);
    expect(follow.status).toBe(404);
  });

  it('DELETE /api/recipes/:id cascades to CookLog and MealPlanSlot dependents', async () => {
    const ids = await seedIngredients();
    const created = await request(app)
      .post('/api/recipes')
      .send({
        name: 'With Dependents',
        ingredients: [{ ingredientId: ids.salt, quantity: 1, unit: 'g' }],
      });
    const recipeId = created.body.id;
    await prisma.cookLog.createMany({
      data: [{ recipeId }, { recipeId }],
    });
    await prisma.mealPlanSlot.create({
      data: { recipeId, date: new Date('2026-07-26'), slot: 'dinner' },
    });
    const del = await request(app).delete(`/api/recipes/${recipeId}`);
    expect(del.status).toBe(204);
    expect(await prisma.recipe.count({ where: { id: recipeId } })).toBe(0);
    expect(await prisma.recipeIngredient.count({ where: { recipeId } })).toBe(0);
    expect(await prisma.cookLog.count({ where: { recipeId } })).toBe(0);
    expect(await prisma.mealPlanSlot.count({ where: { recipeId } })).toBe(0);
  });

  it('DELETE /api/recipes/:id nulls out CartSnapshot.recipeId instead of deleting the snapshot', async () => {
    const ids = await seedIngredients();
    const created = await request(app)
      .post('/api/recipes')
      .send({
        name: 'With Cart',
        ingredients: [{ ingredientId: ids.salt, quantity: 1, unit: 'g' }],
      });
    const recipeId = created.body.id;
    const snapshot = await prisma.cartSnapshot.create({
      data: { recipeId, itemsJson: '{}' },
    });
    const del = await request(app).delete(`/api/recipes/${recipeId}`);
    expect(del.status).toBe(204);
    const after = await prisma.cartSnapshot.findUnique({ where: { id: snapshot.id } });
    expect(after).not.toBeNull();
    expect(after?.recipeId).toBeNull();
  });

  it('DELETE /api/recipes/:id with unknown id returns 404', async () => {
    const res = await request(app).delete('/api/recipes/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('DELETE /api/recipes/:id succeeds for a freshly created recipe with no dependents (bug reproducer)', async () => {
    const ids = await seedIngredients();
    const created = await request(app)
      .post('/api/recipes')
      .send({
        name: 'Lonely Recipe',
        ingredients: [{ ingredientId: ids.salt, quantity: 1, unit: 'g' }],
      });
    const recipeId = created.body.id;
    expect(
      await prisma.mealPlanSlot.count({ where: { recipeId } }),
    ).toBe(0);
    expect(await prisma.cookLog.count({ where: { recipeId } })).toBe(0);
    expect(await prisma.cartSnapshot.count({ where: { recipeId } })).toBe(0);

    const del = await request(app).delete(`/api/recipes/${recipeId}`);
    expect(del.status).toBe(204);
    expect(await prisma.recipe.count({ where: { id: recipeId } })).toBe(0);
    expect(await prisma.recipeIngredient.count({ where: { recipeId } })).toBe(0);

    const list = await request(app).get('/api/recipes');
    expect(list.status).toBe(200);
    expect(list.body).toEqual([]);
  });

  it('DELETE /api/recipes/:id removes dependents and recipe rows in one transaction', async () => {
    const ids = await seedIngredients();
    const created = await request(app)
      .post('/api/recipes')
      .send({
        name: 'With Everything',
        ingredients: [
          { ingredientId: ids.salt, quantity: 1, unit: 'g' },
          { ingredientId: ids.milk, quantity: 50, unit: 'ml' },
        ],
      });
    const recipeId = created.body.id;
    const snapshot = await prisma.cartSnapshot.create({
      data: { recipeId, itemsJson: '{}' },
    });
    await prisma.cookLog.create({ data: { recipeId } });
    await prisma.mealPlanSlot.create({
      data: { recipeId, date: new Date('2026-07-26'), slot: 'lunch' },
    });

    const del = await request(app).delete(`/api/recipes/${recipeId}`);
    expect(del.status).toBe(204);
    expect(await prisma.recipe.count({ where: { id: recipeId } })).toBe(0);
    expect(await prisma.recipeIngredient.count({ where: { recipeId } })).toBe(0);
    expect(await prisma.cookLog.count({ where: { recipeId } })).toBe(0);
    expect(await prisma.mealPlanSlot.count({ where: { recipeId } })).toBe(0);
    const after = await prisma.cartSnapshot.findUnique({ where: { id: snapshot.id } });
    expect(after).not.toBeNull();
    expect(after?.recipeId).toBeNull();
  });

  it('DELETE /api/recipes/:id still succeeds when the FK cascade rule on RecipeIngredient is unavailable', async () => {
    const ids = await seedIngredients();
    const created = await prisma.recipe.create({ data: { title: 'Stale DB' } });
    await prisma.recipeIngredient.create({
      data: { recipeId: created.id, ingredientId: ids.salt, quantity: 1, unit: 'g' },
    });
    expect(
      await prisma.recipeIngredient.count({ where: { recipeId: created.id } }),
    ).toBe(1);

    const del = await request(app).delete(`/api/recipes/${created.id}`);
    expect(del.status).toBe(204);
    expect(await prisma.recipe.count({ where: { id: created.id } })).toBe(0);
    expect(
      await prisma.recipeIngredient.count({ where: { recipeId: created.id } }),
    ).toBe(0);
  });
});
