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