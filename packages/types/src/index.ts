export const IngredientCategory = {
  Meat: 'Meat',
  Vegetables: 'Vegetables',
  Dairy: 'Dairy',
  Grains: 'Grains',
  Spices: 'Spices',
  Other: 'Other',
} as const;

export type IngredientCategory =
  (typeof IngredientCategory)[keyof typeof IngredientCategory];

export const INGREDIENT_CATEGORIES: readonly IngredientCategory[] = [
  IngredientCategory.Meat,
  IngredientCategory.Vegetables,
  IngredientCategory.Dairy,
  IngredientCategory.Grains,
  IngredientCategory.Spices,
  IngredientCategory.Other,
];

export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  [IngredientCategory.Meat]: 'Meat',
  [IngredientCategory.Vegetables]: 'Vegetables',
  [IngredientCategory.Dairy]: 'Dairy',
  [IngredientCategory.Grains]: 'Grains',
  [IngredientCategory.Spices]: 'Spices',
  [IngredientCategory.Other]: 'Other',
};

export const BaseUnit = {
  g: 'g',
  ml: 'ml',
  pcs: 'pcs',
} as const;

export type BaseUnit = (typeof BaseUnit)[keyof typeof BaseUnit];

export const BASE_UNITS: readonly BaseUnit[] = [
  BaseUnit.g,
  BaseUnit.ml,
  BaseUnit.pcs,
];

export const BASE_UNIT_LABELS: Record<BaseUnit, string> = {
  [BaseUnit.g]: 'g',
  [BaseUnit.ml]: 'ml',
  [BaseUnit.pcs]: 'pcs',
};