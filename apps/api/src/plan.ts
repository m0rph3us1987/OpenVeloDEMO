import { Prisma, PrismaClient } from '@prisma/client';
import { Router, type Response } from 'express';
import { z } from 'zod';
import type { PlanApiError } from './errors.js';
import {
  HttpError,
  PLAN_SLOTS,
  dateForDay,
  fieldError,
  isIsoWeek,
  resolveWeek,
} from './plan-utils.js';
import { fetchCurrentWeek, recomputeAutoCartForWeek } from './cart-recompute.js';

const SLOT_VALUES = PLAN_SLOTS as readonly [string, ...string[]];

const slotSchema = z.enum(SLOT_VALUES);
const daySchema = z
  .number({ invalid_type_error: 'day must be a number' })
  .int('day must be an integer')
  .min(1, 'day must be between 1 and 7')
  .max(7, 'day must be between 1 and 7');

const weekStringSchema = z
  .string()
  .regex(
    /^(\d{4})-W(0[1-9]|[1-4][0-9]|5[0-3])$/,
    'week must be an ISO week label YYYY-Www',
  );

const createSchema = z
  .object({
    week: weekStringSchema.optional(),
    day: daySchema,
    slot: slotSchema,
    recipeId: z.string().min(1, 'recipeId is required'),
    notes: z.string().max(2000).optional(),
  })
  .strict();

const patchSchema = z
  .object({
    day: daySchema.optional(),
    slot: slotSchema.optional(),
    recipeId: z.string().min(1).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'patch must include at least one field',
  });

const weekQuerySchema = z
  .object({ week: weekStringSchema.optional() })
  .strict();

function sendError(res: Response, err: HttpError): void {
  res.status(err.status).json(err.body);
}

function sendValidation(
  res: Response,
  details: Array<{ field: string; message: string }>,
  message = 'Invalid input',
): void {
  const body: PlanApiError = {
    error: message,
    code: 'INVALID_INPUT',
    details,
  };
  res.status(400).json(body);
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

function notFound(error: string, code = 'NOT_FOUND'): HttpError {
  return new HttpError(404, { error, code } satisfies PlanApiError);
}

export type PlanSlotRecord = {
  id: string;
  day: number;
  date: string;
  slot: string;
  recipeId: string;
  recipeName: string;
  notes: string | null;
  cookedCount: number;
};

export type StatsItem = {
  recipeId: string;
  recipeName: string;
  count: number;
  lastCookedAt: string | null;
};

export type StatsResponse = {
  items: StatsItem[];
};

type PlanSlotRow = Prisma.MealPlanSlotGetPayload<{
  include: {
    recipe: true;
    _count: { select: { cookLogs: true } };
  };
}>;

type RecipeWithCookLogs = Prisma.RecipeGetPayload<{
  include: {
    cookLogs: { select: { cookedAt: true } };
  };
}>;

function mapSlot(row: PlanSlotRow): PlanSlotRecord {
  return {
    id: row.id,
    day: row.day,
    date: row.date.toISOString().slice(0, 10),
    slot: row.slot,
    recipeId: row.recipeId,
    recipeName: row.recipe.title,
    notes: row.notes ?? null,
    cookedCount: row._count.cookLogs,
  };
}

/**
 * Build the lifetime cook statistics for every recipe, including
 * never-cooked recipes. The returned array is sorted by count descending,
 * then by recipe name ascending, then by id ascending to keep the order
 * stable across calls.
 */
export function mapCookLogStats(recipes: RecipeWithCookLogs[]): StatsItem[] {
  return recipes
    .map((recipe) => {
      const lastLog = recipe.cookLogs
        .map((log) => log.cookedAt)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return {
        recipeId: recipe.id,
        recipeName: recipe.title,
        count: recipe.cookLogs.length,
        lastCookedAt: lastLog ? lastLog.toISOString() : null,
      };
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.recipeName.localeCompare(b.recipeName) ||
        a.recipeId.localeCompare(b.recipeId),
    );
}

async function loadLifetimeStats(prisma: PrismaClient): Promise<StatsResponse> {
  const recipes = await prisma.recipe.findMany({
    orderBy: { title: 'asc' },
    include: { cookLogs: { select: { cookedAt: true } } },
  });
  return { items: mapCookLogStats(recipes) };
}

async function ensureRecipeExists(
  prisma: PrismaClient,
  recipeId: string,
): Promise<Prisma.RecipeGetPayload<Record<string, never>>> {
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) {
    throw notFound('Recipe not found');
  }
  return recipe;
}

async function recomputeIfCurrentWeek(
  prisma: PrismaClient,
  week: string,
): Promise<void> {
  const current = await fetchCurrentWeek(prisma);
  if (current === week) {
    await recomputeAutoCartForWeek(prisma, week);
  }
}

export function createPlanRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const parsed = weekQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        sendValidation(res, fieldErrorsFromZod(parsed.error));
        return;
      }
      const range = resolveWeek(parsed.data.week);
      const rows = await prisma.mealPlanSlot.findMany({
        where: { week: range.week },
        orderBy: [{ day: 'asc' }, { id: 'asc' }],
        include: {
          recipe: true,
          _count: { select: { cookLogs: true } },
        },
      });
      res.status(200).json({
        week: range.week,
        weekStart: range.weekStart,
        weekEnd: range.weekEnd,
        slots: rows.map(mapSlot),
      });
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err);
        return;
      }
      next(err);
    }
  });

  router.get('/stats', async (req, res, next) => {
    try {
      const parsed = weekQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        sendValidation(res, fieldErrorsFromZod(parsed.error));
        return;
      }
      const range = resolveWeek(parsed.data.week);
      const recipes = await prisma.recipe.findMany({
        where: { mealSlots: { some: { week: range.week } } },
        orderBy: { title: 'asc' },
        include: { cookLogs: { select: { cookedAt: true } } },
      });
      res.status(200).json({ week: range.week, items: mapCookLogStats(recipes) });
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err);
        return;
      }
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidation(res, fieldErrorsFromZod(parsed.error));
      return;
    }
    const data = parsed.data;
    const range = resolveWeek(data.week);
    try {
      await ensureRecipeExists(prisma, data.recipeId);
      const date = dateForDay(range.weekStart, data.day);
      const created = await prisma.mealPlanSlot.create({
        data: {
          week: range.week,
          day: data.day,
          date,
          slot: data.slot,
          recipeId: data.recipeId,
          notes: data.notes ?? null,
        },
      });
      await recomputeIfCurrentWeek(prisma, range.week);
      const withRelations = await prisma.mealPlanSlot.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          recipe: true,
          _count: { select: { cookLogs: true } },
        },
      });
      const record = mapSlot(withRelations);
      res.status(201).location(`/api/plan/${record.id}`).json(record);
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err);
        return;
      }
      if (isPrismaKnownError(err) && err.code === 'P2003') {
        sendValidation(res, [
          fieldError('recipeId', 'recipe does not exist'),
        ]);
        return;
      }
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    const id = req.params.id;
    if (!id) {
      sendValidation(res, [fieldError('id', 'id is required')]);
      return;
    }
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidation(res, fieldErrorsFromZod(parsed.error));
      return;
    }
    try {
      const existing = await prisma.mealPlanSlot.findUnique({
        where: { id },
        include: { recipe: true },
      });
      if (!existing) {
        sendError(res, notFound('Planned slot not found'));
        return;
      }
      if (parsed.data.recipeId && parsed.data.recipeId !== existing.recipeId) {
        await ensureRecipeExists(prisma, parsed.data.recipeId);
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.mealPlanSlot.update({
          where: { id },
          data: {
            day: parsed.data.day ?? undefined,
            slot: parsed.data.slot ?? undefined,
            recipeId: parsed.data.recipeId ?? undefined,
            notes:
              parsed.data.notes === undefined
                ? undefined
                : parsed.data.notes,
            date:
              parsed.data.day !== undefined
                ? dateForDay(
                    resolveWeek(existing.week).weekStart,
                    parsed.data.day,
                  )
                : undefined,
          },
        });
        return tx.mealPlanSlot.findUniqueOrThrow({
          where: { id },
          include: {
            recipe: true,
            _count: { select: { cookLogs: true } },
          },
        });
      });

      await recomputeIfCurrentWeek(prisma, updated.week);
      res.status(200).json(mapSlot(updated));
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err);
        return;
      }
      if (isPrismaKnownError(err) && err.code === 'P2003') {
        sendValidation(res, [
          fieldError('recipeId', 'recipe does not exist'),
        ]);
        return;
      }
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    const id = req.params.id;
    if (!id) {
      sendValidation(res, [fieldError('id', 'id is required')]);
      return;
    }
    try {
      const existing = await prisma.mealPlanSlot.findUnique({ where: { id } });
      if (!existing) {
        sendError(res, notFound('Planned slot not found'));
        return;
      }
      await prisma.mealPlanSlot.delete({ where: { id } });
      await recomputeIfCurrentWeek(prisma, existing.week);
      res.status(204).end();
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err);
        return;
      }
      next(err);
    }
  });

  router.post('/:id/cooked', async (req, res, next) => {
    const id = req.params.id;
    if (!id) {
      sendValidation(res, [fieldError('id', 'id is required')]);
      return;
    }
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const slot = await tx.mealPlanSlot.findUnique({
          where: { id },
          include: { recipe: true },
        });
        if (!slot) {
          throw notFound('Planned slot not found');
        }
        await tx.cookLog.create({
          data: {
            recipeId: slot.recipeId,
            mealPlanSlotId: slot.id,
          },
        });
        return tx.mealPlanSlot.findUniqueOrThrow({
          where: { id },
          include: {
            recipe: true,
            _count: { select: { cookLogs: true } },
          },
        });
      });
      res.status(200).json(mapSlot(updated));
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err);
        return;
      }
      next(err);
    }
  });

  return router;
}

export function createStatsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const stats = await loadLifetimeStats(prisma);
      res.status(200).json(stats);
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err);
        return;
      }
      next(err);
    }
  });

  return router;
}

// Re-export iso validation helper for callers that want to reuse the parser.
export { isIsoWeek };
