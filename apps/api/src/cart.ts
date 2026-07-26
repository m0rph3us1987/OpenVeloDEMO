import { Router, type Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  HttpError,
  fieldError,
  isIsoWeek,
} from './plan-utils.js';
import { fetchCurrentWeek } from './cart-recompute.js';
import {
  DISPLAY_UNITS,
  getCurrentCart,
  listCartWeeks,
  loadCartForWeek,
  unitToBase,
  type CartLineRecord,
} from './cart-snapshot.js';
import type { PlanApiError } from './errors.js';

const displayUnitSchema = z.enum(
  DISPLAY_UNITS as readonly ['g', ...typeof DISPLAY_UNITS[number][]],
);

const createLineSchema = z
  .object({
    ingredientId: z.string().min(1, 'ingredientId is required'),
    quantity: z
      .number({ invalid_type_error: 'quantity must be a number' })
      .finite('quantity must be a finite number')
      .positive('quantity must be greater than 0'),
    unit: displayUnitSchema,
    note: z.string().max(2000).optional(),
  })
  .strict();

const patchLineSchema = z
  .object({
    quantity: z
      .number({ invalid_type_error: 'quantity must be a number' })
      .finite('quantity must be a finite number')
      .positive('quantity must be greater than 0')
      .optional(),
    unit: displayUnitSchema.optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'patch must include at least one field',
  });

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

function notFound(error: string, code = 'NOT_FOUND'): HttpError {
  return new HttpError(404, { error, code } satisfies PlanApiError);
}

function conflict(error: string, code: string): HttpError {
  return new HttpError(409, { error, code } satisfies PlanApiError);
}

function isPrismaKnownError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError;
}

type CartItemRow = Prisma.CartItemGetPayload<{
  include: { ingredient: true };
}>;

function toLineRecord(row: CartItemRow): CartLineRecord {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredient.name,
    category: row.ingredient.category as CartLineRecord['category'],
    quantity: row.quantity,
    unit: row.unit as 'g' | 'ml' | 'pcs',
    note: row.note ?? null,
    source: row.source as 'auto' | 'manual',
    week: row.week,
  };
}

export function createCartRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const cart = await getCurrentCart(prisma);
      res.status(200).json(cart);
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err);
        return;
      }
      next(err);
    }
  });

  router.get('/weeks', async (_req, res, next) => {
    try {
      const summaries = await listCartWeeks(prisma);
      res.status(200).json(summaries);
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err);
        return;
      }
      next(err);
    }
  });

  router.get('/weeks/:weekKey', async (req, res, next) => {
    const weekKey = req.params.weekKey;
    if (!weekKey || !isIsoWeek(weekKey)) {
      sendValidation(res, [
        fieldError('weekKey', 'weekKey must be an ISO week label YYYY-Www'),
      ]);
      return;
    }
    try {
      const current = await fetchCurrentWeek(prisma);
      const cart = await loadCartForWeek(prisma, weekKey, current);
      res.status(200).json(cart);
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err);
        return;
      }
      next(err);
    }
  });

  router.post('/lines', async (req, res, next) => {
    const parsed = createLineSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidation(res, fieldErrorsFromZod(parsed.error));
      return;
    }
    const data = parsed.data;
    const normalized = unitToBase(data.unit);
    if (!normalized) {
      sendValidation(res, [fieldError('unit', 'unit is not supported')]);
      return;
    }
    try {
      const ingredient = await prisma.ingredient.findUnique({
        where: { id: data.ingredientId },
      });
      if (!ingredient) {
        sendError(res, notFound('Ingredient not found'));
        return;
      }
      const current = await fetchCurrentWeek(prisma);
      const baseIncrement = data.quantity * normalized.factor;
      // Each POST creates a distinct manual CartItem row. Repeating the
      // same (ingredientId, unit) adds a new row instead of incrementing
      // an existing one; the previous note is preserved on the existing
      // row and a new line (with its own note) is created. Use PATCH to
      // edit any single line.
      const created = await prisma.cartItem.create({
        data: {
          week: current,
          ingredientId: data.ingredientId,
          unit: normalized.unit,
          quantity: baseIncrement,
          source: 'manual',
          note: data.note ?? null,
        },
        include: { ingredient: true },
      });
      const record = toLineRecord(created);
      res.status(201).location(`/api/cart/lines/${record.id}`).json(record);
    } catch (err) {
      if (isPrismaKnownError(err) && err.code === 'P2003') {
        sendValidation(res, [
          fieldError('ingredientId', 'ingredient does not exist'),
        ]);
        return;
      }
      next(err);
    }
  });

  /**
   * PATCH /api/cart/lines/:id — quantity/unit semantics:
   *
   *   - `quantity` + `unit`  → normalise `quantity` through `unitToBase(unit)`
   *                            and store the resulting base quantity under
   *                            the resolved base unit.
   *   - `quantity` only      → treat the submitted `quantity` as a **base-unit**
   *                            amount for the line's existing base unit; the
   *                            value is stored verbatim. No display-context
   *                            conversion is performed.
   *   - `unit` only          → convert the stored base quantity from the
   *                            existing base unit to the new base unit
   *                            (e.g. g → kg factor 1000; ml → l factor 1000;
   *                            pcs unchanged).
   *
   * The endpoint never assigns an un-normalised display amount to a
   * base-unit column.
   */
  router.patch('/lines/:id', async (req, res, next) => {
    const id = req.params.id;
    if (!id) {
      sendValidation(res, [fieldError('id', 'id is required')]);
      return;
    }
    const parsed = patchLineSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidation(res, fieldErrorsFromZod(parsed.error));
      return;
    }
    try {
      const existing = await prisma.cartItem.findUnique({
        where: { id },
        include: { ingredient: true },
      });
      if (!existing) {
        sendError(res, notFound('Cart line not found'));
        return;
      }
      const current = await fetchCurrentWeek(prisma);
      if (existing.week !== current) {
        sendError(
          res,
          conflict('Cart lines can only be modified in the current week', 'NOT_CURRENT_WEEK'),
        );
        return;
      }
      if (existing.source !== 'manual') {
        sendError(
          res,
          conflict('Auto cart lines cannot be edited', 'NOT_MANUAL_LINE'),
        );
        return;
      }

      const data: Prisma.CartItemUpdateInput = {};
      if (parsed.data.note !== undefined) data.note = parsed.data.note;

      const qtyProvided = parsed.data.quantity !== undefined;
      const unitProvided = parsed.data.unit !== undefined;

      if (qtyProvided && unitProvided) {
        const normalized = unitToBase(parsed.data.unit!);
        if (!normalized) {
          sendValidation(res, [fieldError('unit', 'unit is not supported')]);
          return;
        }
        data.unit = normalized.unit;
        data.quantity = parsed.data.quantity! * normalized.factor;
      } else if (qtyProvided) {
        // Submitted quantity is treated as a base-unit amount for the
        // row's current stored base unit — no conversion.
        data.quantity = parsed.data.quantity;
      } else if (unitProvided) {
        const unitInput = parsed.data.unit as string;
        const normalized = unitToBase(unitInput);
        if (!normalized) {
          sendValidation(res, [fieldError('unit', 'unit is not supported')]);
          return;
        }
        const fromBase = unitToBase(existing.unit);
        if (!fromBase) {
          sendError(
            res,
            conflict('Existing line has an unsupported unit', 'INVALID_UNIT'),
          );
          return;
        }
        // existing.quantity is already in `fromBase.unit`. Convert to
        // the new base unit by scaling through the base-unit product
        // (which is identical for all base units in this app — g, ml,
        // pcs — so the math is a no-op for cross-base conversions that
        // don't change the underlying "weight/volume/count" dimension).
        const baseQuantity = existing.quantity / fromBase.factor;
        data.unit = normalized.unit;
        data.quantity = baseQuantity * normalized.factor;
      }

      const updated = await prisma.cartItem.update({
        where: { id },
        data,
        include: { ingredient: true },
      });
      res.status(200).json(toLineRecord(updated));
    } catch (err) {
      if (err instanceof HttpError) {
        sendError(res, err);
        return;
      }
      next(err);
    }
  });

  router.delete('/lines/:id', async (req, res, next) => {
    const id = req.params.id;
    if (!id) {
      sendValidation(res, [fieldError('id', 'id is required')]);
      return;
    }
    try {
      const existing = await prisma.cartItem.findUnique({ where: { id } });
      if (!existing) {
        sendError(res, notFound('Cart line not found'));
        return;
      }
      const current = await fetchCurrentWeek(prisma);
      if (existing.week !== current) {
        sendError(
          res,
          conflict('Cart lines can only be modified in the current week', 'NOT_CURRENT_WEEK'),
        );
        return;
      }
      if (existing.source !== 'manual') {
        sendError(
          res,
          conflict('Auto cart lines cannot be deleted', 'NOT_MANUAL_LINE'),
        );
        return;
      }
      await prisma.cartItem.delete({ where: { id } });
      res.status(204).end();
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