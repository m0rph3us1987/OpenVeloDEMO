-- Idempotent seed for the Ingredient table.
-- Uses INSERT OR IGNORE on the unique "name" index so the script is safe
-- to re-run against an already-populated database.

INSERT OR IGNORE INTO "Ingredient" ("id", "name", "category", "defaultUnit", "createdAt", "updatedAt") VALUES
  ('seed-meat-beef',   'Beef',      'Meat',      'g',   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-veg-tomato',  'Tomato',    'Vegetables','pcs', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-dairy-milk',  'Milk',      'Dairy',     'ml',  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-grain-rice',  'Rice',      'Grains',    'g',   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-spice-salt',  'Salt',      'Spices',    'g',   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-spice-pepper','Pepper',    'Spices',    'g',   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed-other-olive', 'Olive Oil', 'Other',     'ml',  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Idempotent demo recipe + ingredient rows. Safe to re-run because of
-- INSERT OR IGNORE on the primary key.

INSERT OR IGNORE INTO "Recipe" ("id", "title", "description", "servings", "createdAt", "updatedAt") VALUES
  ('seed-recipe-stew', 'Hearty Stew', 'Demo recipe seeded by ensure-db.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO "RecipeIngredient" ("id", "recipeId", "ingredientId", "quantity", "unit") VALUES
  ('seed-ri-stew-1', 'seed-recipe-stew', 'seed-meat-beef',  200, 'g'),
  ('seed-ri-stew-2', 'seed-recipe-stew', 'seed-veg-tomato',   3, 'pcs');
