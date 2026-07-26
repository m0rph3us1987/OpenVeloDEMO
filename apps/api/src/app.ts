import cors from 'cors';
import express, { type Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createIngredientsRouter } from './ingredients.js';
import { createRecipesRouter } from './recipes.js';
import { createPlanRouter, createStatsRouter } from './plan.js';
import { createCartRouter } from './cart.js';

export function createApp(prisma?: PrismaClient): Express {
  const app = express();

  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  app.use(
    cors({
      origin: webOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const client = prisma ?? new PrismaClient();
  app.use('/api/ingredients', createIngredientsRouter((client as PrismaClient)));
  app.use('/api/recipes', createRecipesRouter((client as PrismaClient)));
  app.use('/api/plan', createPlanRouter((client as PrismaClient)));
  app.use('/api/stats', createStatsRouter((client as PrismaClient)));
  app.use('/api/cart', createCartRouter((client as PrismaClient)));

  return app;
}
