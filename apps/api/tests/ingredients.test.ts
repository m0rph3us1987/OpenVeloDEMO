import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  const tempPath = path.join(
    os.tmpdir(),
    `openvelo-api-ingredient-${process.pid}-${Date.now()}-${randomBytes(4).toString('hex')}.db`,
  );
  const databaseUrl = `file:${tempPath}`;
  process.env.DATABASE_URL = databaseUrl;
  const prismaBin = path.resolve(__dirname, '..', '..', '..', 'node_modules', '.bin', 'prisma');
  const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
  const constraintsPath = path.resolve(__dirname, '..', 'prisma', 'constraints.sql');
  execFileSync(
    prismaBin,
    ['db', 'push', '--skip-generate', '--accept-data-loss', '--schema', schemaPath],
    {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    },
  );
  execFileSync(
    prismaBin,
    ['db', 'execute', '--schema', schemaPath, '--file', constraintsPath],
    {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    },
  );
}

const prisma = new PrismaClient();

async function reset(): Promise<void> {
  await prisma.recipeIngredient.deleteMany();
  await prisma.cookLog.deleteMany();
  await prisma.ingredient.deleteMany();
}

const app = createApp(prisma);

afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

describe('Ingredients API', () => {
  beforeEach(async () => {
    await reset();
  });

  it('GET /api/ingredients returns [] when empty', async () => {
    const res = await request(app).get('/api/ingredients');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/ingredients creates an ingredient and returns 201 with baseUnit', async () => {
    const res = await request(app)
      .post('/api/ingredients')
      .send({ name: 'Salt', category: 'Spices', baseUnit: 'g' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      name: 'Salt',
      category: 'Spices',
      baseUnit: 'g',
    });
    expect(res.headers.location).toBe(`/api/ingredients/${res.body.id}`);
  });

  it('GET /api/ingredients lists created ingredients', async () => {
    await request(app).post('/api/ingredients').send({ name: 'Milk', category: 'Dairy', baseUnit: 'ml' });
    await request(app).post('/api/ingredients').send({ name: 'Apple', category: 'Vegetables', baseUnit: 'pcs' });
    const res = await request(app).get('/api/ingredients');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((i: { name: string }) => i.name)).toEqual(['Apple', 'Milk']);
  });

  it('PATCH /api/ingredients/:id updates only provided fields', async () => {
    const created = await request(app)
      .post('/api/ingredients')
      .send({ name: 'Beef', category: 'Meat', baseUnit: 'g' });
    const res = await request(app)
      .patch(`/api/ingredients/${created.body.id}`)
      .send({ category: 'Other' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: created.body.id,
      name: 'Beef',
      category: 'Other',
      baseUnit: 'g',
    });
  });

  it('DELETE /api/ingredients/:id returns 204 and removes the ingredient', async () => {
    const created = await request(app)
      .post('/api/ingredients')
      .send({ name: 'Wheat', category: 'Grains', baseUnit: 'g' });
    const del = await request(app).delete(`/api/ingredients/${created.body.id}`);
    expect(del.status).toBe(204);
    expect(del.body).toEqual({});
    const list = await request(app).get('/api/ingredients');
    expect(list.body).toEqual([]);
  });

  it('POST invalid payload returns 400 with field-level details', async () => {
    const res = await request(app)
      .post('/api/ingredients')
      .send({ name: '', category: 'Wrong', baseUnit: 'kg' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_INPUT');
    expect(Array.isArray(res.body.details)).toBe(true);
    const fields = (res.body.details as Array<{ field: string }>).map((d) => d.field).sort();
    expect(fields).toEqual(['baseUnit', 'category', 'name'].sort());
  });

  it('POST missing name returns 400', async () => {
    const res = await request(app)
      .post('/api/ingredients')
      .send({ category: 'Spices', baseUnit: 'g' });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { field: 'name', message: expect.any(String) },
    ]);
  });

  it('PATCH unknown id returns 404', async () => {
    const res = await request(app)
      .patch('/api/ingredients/does-not-exist')
      .send({ name: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('DELETE unknown id returns 404', async () => {
    const res = await request(app).delete('/api/ingredients/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('POST duplicate name returns 409', async () => {
    await request(app).post('/api/ingredients').send({ name: 'Pepper', category: 'Spices', baseUnit: 'g' });
    const res = await request(app).post('/api/ingredients').send({ name: 'Pepper', category: 'Spices', baseUnit: 'g' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NAME_CONFLICT');
    expect(res.body.details).toEqual([
      { field: 'name', message: 'name must be unique' },
    ]);
  });

  it('PATCH rename to a duplicate name returns 409', async () => {
    await request(app).post('/api/ingredients').send({ name: 'A', category: 'Spices', baseUnit: 'g' });
    const b = await request(app).post('/api/ingredients').send({ name: 'B', category: 'Spices', baseUnit: 'g' });
    const res = await request(app).patch(`/api/ingredients/${b.body.id}`).send({ name: 'A' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NAME_CONFLICT');
  });

  it('PATCH empty body returns 400', async () => {
    const created = await request(app).post('/api/ingredients').send({ name: 'Cumin', category: 'Spices', baseUnit: 'g' });
    const res = await request(app).patch(`/api/ingredients/${created.body.id}`).send({});
    expect(res.status).toBe(400);
  });
});
