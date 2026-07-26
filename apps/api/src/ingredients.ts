import { Router, type Request, type Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  BASE_UNITS,
  BaseUnit,
  INGREDIENT_CATEGORIES,
  IngredientCategory,
} from '@openvelo/types';
import { z } from 'zod';

export type IngredientRecord = {
  id: string;
  name: string;
  category: IngredientCategory;
  baseUnit: BaseUnit;
};

export type IngredientError = {
  error: string;
  code?: string;
  details?: Array<{ field: string; message: string }>;
};

function toRecord(row: {
  id: string;
  name: string;
  category: string;
  defaultUnit: string;
}): IngredientRecord {
  return {
    id: row.id,
    name: row.name,
    category: row.category as IngredientCategory,
    baseUnit: row.defaultUnit as BaseUnit,
  };
}

const categorySchema = z.enum(
  INGREDIENT_CATEGORIES as readonly [IngredientCategory, ...IngredientCategory[]],
);

const baseUnitSchema = z.enum(
  BASE_UNITS as readonly [BaseUnit, ...BaseUnit[]],
);

const createSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  category: categorySchema,
  baseUnit: baseUnitSchema,
});

const patchSchema = z
  .object({
    name: z.string().trim().min(1, 'name cannot be empty').optional(),
    category: categorySchema.optional(),
    baseUnit: baseUnitSchema.optional(),
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
  } satisfies IngredientError);
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

export function createIngredientsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const rows = await prisma.ingredient.findMany({
        orderBy: { name: 'asc' },
      });
      res.status(200).json(rows.map(toRecord));
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
    try {
      const created = await prisma.ingredient.create({
        data: {
          name: parsed.data.name,
          category: parsed.data.category,
          defaultUnit: parsed.data.baseUnit,
        },
      });
      const record = toRecord(created);
      res.status(201).location(`/api/ingredients/${record.id}`).json(record);
    } catch (err) {
      if (isPrismaKnownError(err) && err.code === 'P2002') {
        res.status(409).json({
          error: 'Ingredient name already exists',
          code: 'NAME_CONFLICT',
          details: [{ field: 'name', message: 'name must be unique' }],
        } satisfies IngredientError);
        return;
      }
      next(err);
    }
  });

  router.patch('/:id', async (req: Request, res: Response, next) => {
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
    try {
      const existing = await prisma.ingredient.findUnique({ where: { id } });
      if (!existing) {
        res
          .status(404)
          .json({ error: 'Ingredient not found', code: 'NOT_FOUND' } satisfies IngredientError);
        return;
      }
      const data: Prisma.IngredientUpdateInput = {};
      if (parsed.data.name !== undefined) data.name = parsed.data.name;
      if (parsed.data.category !== undefined) data.category = parsed.data.category;
      if (parsed.data.baseUnit !== undefined) data.defaultUnit = parsed.data.baseUnit;
      const updated = await prisma.ingredient.update({ where: { id }, data });
      res.status(200).json(toRecord(updated));
    } catch (err) {
      if (isPrismaKnownError(err) && err.code === 'P2002') {
        res.status(409).json({
          error: 'Ingredient name already exists',
          code: 'NAME_CONFLICT',
          details: [{ field: 'name', message: 'name must be unique' }],
        } satisfies IngredientError);
        return;
      }
      next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next) => {
    const id = req.params.id;
    if (!id) {
      sendValidationError(res, [{ field: 'id', message: 'id is required' }]);
      return;
    }
    try {
      const existing = await prisma.ingredient.findUnique({ where: { id } });
      if (!existing) {
        res
          .status(404)
          .json({ error: 'Ingredient not found', code: 'NOT_FOUND' } satisfies IngredientError);
        return;
      }
      await prisma.$transaction(async (tx) => {
        await tx.recipeIngredient.deleteMany({ where: { ingredientId: id } });
        await tx.cookLog.deleteMany({ where: { ingredientId: id } });
        await tx.cartItem.deleteMany({ where: { ingredientId: id } });
        await tx.ingredient.delete({ where: { id } });
      });
      res.status(204).end();
    } catch (err) {
      if (isPrismaKnownError(err) && err.code === 'P2003') {
        res.status(409).json({
          error: 'Ingredient is referenced by other records',
          code: 'REFERENCED_BY_OTHER_RECORD',
        } satisfies IngredientError);
        return;
      }
      next(err);
    }
  });

  return router;
}
