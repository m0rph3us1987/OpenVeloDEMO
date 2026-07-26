-- Idempotent database-level enforcement for the RecipeIngredient.unit enum.
--
-- Prisma's CHECK clauses from the migration are not materialised by
-- `prisma db push`, so this trigger is applied by apps/api/scripts/ensure-db.mjs
-- after every bootstrap. CREATE TRIGGER IF NOT EXISTS keeps the script safe
-- to re-run.
--
-- The trigger raises ABORT with a stable message that surfaces in the API as
-- a generic 500; the API router's zod validation already prevents the API
-- from inserting bad values, so this guard is a defence-in-depth measure for
-- any direct database writers.

CREATE TRIGGER IF NOT EXISTS "RecipeIngredient_unit_enum"
BEFORE INSERT ON "RecipeIngredient"
FOR EACH ROW
WHEN NEW."unit" NOT IN ('g', 'ml', 'pcs')
BEGIN
  SELECT RAISE(ABORT, 'RecipeIngredient.unit must be one of g, ml, pcs');
END;

-- Defence-in-depth enforcement for the weekly-planner meal-slot enum
-- ({Breakfast, Lunch, Dinner, Snack}). The API router's zod validation is
-- the primary check; this trigger guards direct database writers.
CREATE TRIGGER IF NOT EXISTS "MealPlanSlot_slot_enum"
BEFORE INSERT ON "MealPlanSlot"
FOR EACH ROW
WHEN NEW."slot" NOT IN ('Breakfast', 'Lunch', 'Dinner', 'Snack')
BEGIN
  SELECT RAISE(ABORT, 'MealPlanSlot.slot must be one of Breakfast, Lunch, Dinner, Snack');
END;

CREATE TRIGGER IF NOT EXISTS "MealPlanSlot_slot_enum_update"
BEFORE UPDATE ON "MealPlanSlot"
FOR EACH ROW
WHEN NEW."slot" NOT IN ('Breakfast', 'Lunch', 'Dinner', 'Snack')
BEGIN
  SELECT RAISE(ABORT, 'MealPlanSlot.slot must be one of Breakfast, Lunch, Dinner, Snack');
END;

-- Restrict day values to the 1..7 range (1 = Monday, 7 = Sunday).
CREATE TRIGGER IF NOT EXISTS "MealPlanSlot_day_range"
BEFORE INSERT ON "MealPlanSlot"
FOR EACH ROW
WHEN NEW."day" < 1 OR NEW."day" > 7
BEGIN
  SELECT RAISE(ABORT, 'MealPlanSlot.day must be between 1 and 7');
END;

CREATE TRIGGER IF NOT EXISTS "MealPlanSlot_day_range_update"
BEFORE UPDATE ON "MealPlanSlot"
FOR EACH ROW
WHEN NEW."day" < 1 OR NEW."day" > 7
BEGIN
  SELECT RAISE(ABORT, 'MealPlanSlot.day must be between 1 and 7');
END;

-- Restrict CartItem.source to the known values.
CREATE TRIGGER IF NOT EXISTS "CartItem_source_enum"
BEFORE INSERT ON "CartItem"
FOR EACH ROW
WHEN NEW."source" NOT IN ('auto', 'manual')
BEGIN
  SELECT RAISE(ABORT, 'CartItem.source must be one of auto, manual');
END;

CREATE TRIGGER IF NOT EXISTS "CartItem_source_enum_update"
BEFORE UPDATE ON "CartItem"
FOR EACH ROW
WHEN NEW."source" NOT IN ('auto', 'manual')
BEGIN
  SELECT RAISE(ABORT, 'CartItem.source must be one of auto, manual');
END;
