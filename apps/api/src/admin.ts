import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { seed, type SeedResult } from './seed.js';

export type AdminResetResponse = {
  ok: true;
  reseeded: true;
  ingredients: number;
  recipes: number;
};

export function createAdminRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post('/reset', async (_req, res, next) => {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.recipeIngredient.deleteMany();
        await tx.mealPlanSlot.deleteMany();
        await tx.cookLog.deleteMany();
        await tx.cartSnapshot.deleteMany();
        await tx.cartItem.deleteMany();
        await tx.cartHistory.deleteMany();
        await tx.recipe.deleteMany();
        await tx.ingredient.deleteMany();
      });
      const result: SeedResult = await seed(prisma);
      const body: AdminResetResponse = {
        ok: true,
        reseeded: true,
        ingredients: result.ingredientsCreated,
        recipes: result.recipesCreated,
      };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}