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
