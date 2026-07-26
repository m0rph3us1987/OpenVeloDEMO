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
