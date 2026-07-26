import { Router, type Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { BASE_UNITS, BaseUnit } from '@openvelo/types';
import { z } from 'zod';

export type RecipeIngredientRecord = {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: BaseUnit;
};

export type RecipeRecord = {
  id: string;
  name: string;
  ingredients: RecipeIngredientRecord[];
  timesCooked: number;
};

export type RecipeError = {
  error: string;
  code?: string;
  details?: Array<{ field: string; message: string }>;
};

type RecipeWithRelations = Prisma.RecipeGetPayload<{
  include: {
    ingredients: { include: { ingredient: true } };
    _count: { select: { cookLogs: true } };
  };
}>;

function toRecord(row: RecipeWithRelations): RecipeRecord {
  return {
    id: row.id,
    name: row.title,
    ingredients: row.ingredients.map((ri) => ({
      ingredientId: ri.ingredientId,
      ingredientName: ri.ingredient.name,
      quantity: ri.quantity,
      unit: ri.unit as BaseUnit,
    })),
    timesCooked: row._count.cookLogs,
  };
}

const baseUnitSchema = z.enum(
  BASE_UNITS as readonly [BaseUnit, ...BaseUnit[]],
);

const ingredientInputSchema = z.object({
  ingredientId: z.string().min(1, 'ingredientId is required'),
  quantity: z
    .number({ invalid_type_error: 'quantity must be a number' })
    .finite('quantity must be a finite number')
    .positive('Quantity must be greater than 0'),
  unit: baseUnitSchema,
});

const ingredientsSchema = z.array(ingredientInputSchema);

const createSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  ingredients: ingredientsSchema,
});

const patchSchema = z
  .object({
    name: z.string().trim().min(1, 'name cannot be empty').optional(),
    ingredients: ingredientsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'patch must include at least one field',
  });

function sendValidationError(
  res: Response,
  details: Array<{ field: string; message: string }>,
  message = 'Invalid input',
): void {
  res.status(400).json({
    error: message,
    code: 'INVALID_INPUT',
    details,
  } satisfies RecipeError);
}

function fieldErrorsFromZod(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '<root>',
    message: issue.message,
  }));
}

function isPrismaKnownError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError;
}

type RecipeInclude = {
  ingredients: { include: { ingredient: true } };
  _count: { select: { cookLogs: true } };
};

const recipeInclude = {
  ingredients: { include: { ingredient: true } },
  _count: { select: { cookLogs: true } },
} satisfies RecipeInclude;

async function collectIngredientErrors(
  prisma: PrismaClient,
  rows: Array<{ ingredientId: string }>,
): Promise<Array<{ field: string; message: string }>> {
  const uniqueIds = Array.from(new Set(rows.map((r) => r.ingredientId)));
  const found = await prisma.ingredient.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  const present = new Set(found.map((r) => r.id));
  const errors: Array<{ field: string; message: string }> = [];
  rows.forEach((row, index) => {
    if (!present.has(row.ingredientId)) {
      errors.push({
        field: `ingredients.${index}.ingredientId`,
        message: 'ingredient does not exist',
      });
    }
  });
  return errors;
}

export function createRecipesRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const rows = await prisma.recipe.findMany({
        orderBy: { title: 'asc' },
        include: recipeInclude,
      });
      res.status(200).json(rows.map(toRecord));
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    const id = req.params.id;
    if (!id) {
      sendValidationError(res, [{ field: 'id', message: 'id is required' }]);
      return;
    }
    try {
      const row = await prisma.recipe.findUnique({
        where: { id },
        include: recipeInclude,
      });
      if (!row) {
        res
          .status(404)
          .json({ error: 'Recipe not found', code: 'NOT_FOUND' } satisfies RecipeError);
        return;
      }
      res.status(200).json(toRecord(row));
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, fieldErrorsFromZod(parsed.error));
      return;
    }
    const ingredientErrors = await collectIngredientErrors(
      prisma,
      parsed.data.ingredients,
    );
    if (ingredientErrors.length > 0) {
      sendValidationError(res, ingredientErrors);
      return;
    }
    try {
      const created = await prisma.$transaction(async (tx) => {
        const recipe = await tx.recipe.create({
          data: {
            title: parsed.data.name,
            servings: 1,
          },
        });
        if (parsed.data.ingredients.length > 0) {
          await tx.recipeIngredient.createMany({
            data: parsed.data.ingredients.map((row) => ({
              recipeId: recipe.id,
              ingredientId: row.ingredientId,
              quantity: row.quantity,
              unit: row.unit,
            })),
          });
        }
        return tx.recipe.findUniqueOrThrow({
          where: { id: recipe.id },
          include: recipeInclude,
        });
      });
      const record = toRecord(created);
      res.status(201).location(`/api/recipes/${record.id}`).json(record);
    } catch (err) {
      if (isPrismaKnownError(err) && err.code === 'P2003') {
        sendValidationError(res, [
          { field: 'ingredients', message: 'ingredient does not exist' },
        ]);
        return;
      }
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    const id = req.params.id;
    if (!id) {
      sendValidationError(res, [{ field: 'id', message: 'id is required' }]);
      return;
    }
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, fieldErrorsFromZod(parsed.error));
      return;
    }
    const ingredientErrors = parsed.data.ingredients
      ? await collectIngredientErrors(prisma, parsed.data.ingredients)
      : [];
    if (ingredientErrors.length > 0) {
      sendValidationError(res, ingredientErrors);
      return;
    }
    try {
      const existing = await prisma.recipe.findUnique({ where: { id } });
      if (!existing) {
        res
          .status(404)
          .json({ error: 'Recipe not found', code: 'NOT_FOUND' } satisfies RecipeError);
        return;
      }
      const updated = await prisma.$transaction(async (tx) => {
        if (parsed.data.name !== undefined) {
          await tx.recipe.update({
            where: { id },
            data: { title: parsed.data.name },
          });
        }
        if (parsed.data.ingredients !== undefined) {
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
          if (parsed.data.ingredients.length > 0) {
            await tx.recipeIngredient.createMany({
              data: parsed.data.ingredients.map((row) => ({
                recipeId: id,
                ingredientId: row.ingredientId,
                quantity: row.quantity,
                unit: row.unit,
              })),
            });
          }
        }
        return tx.recipe.findUniqueOrThrow({
          where: { id },
          include: recipeInclude,
        });
      });
      res.status(200).json(toRecord(updated));
    } catch (err) {
      if (isPrismaKnownError(err) && err.code === 'P2003') {
        sendValidationError(res, [
          { field: 'ingredients', message: 'ingredient does not exist' },
        ]);
        return;
      }
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    const id = req.params.id;
    if (!id) {
      sendValidationError(res, [{ field: 'id', message: 'id is required' }]);
      return;
    }
    try {
      const existing = await prisma.recipe.findUnique({ where: { id } });
      if (!existing) {
        res
          .status(404)
          .json({ error: 'Recipe not found', code: 'NOT_FOUND' } satisfies RecipeError);
        return;
      }
      await prisma.$transaction(async (tx) => {
        await tx.mealPlanSlot.deleteMany({ where: { recipeId: id } });
        await tx.cookLog.deleteMany({ where: { recipeId: id } });
        await tx.cartSnapshot.updateMany({
          where: { recipeId: id },
          data: { recipeId: null },
        });
        await tx.recipe.delete({ where: { id } });
      });
      res.status(204).end();
    } catch (err) {
      if (isPrismaKnownError(err) && err.code === 'P2003') {
        res
          .status(409)
          .json({
            error: 'Recipe cannot be deleted because it is referenced by other records',
            code: 'REFERENCED_BY_OTHER_RECORD',
          } satisfies RecipeError);
        return;
      }
      next(err);
    }
  });

  return router;
}
