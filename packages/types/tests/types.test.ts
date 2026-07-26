import { describe, it, expect } from 'vitest';
import {
  IngredientCategory,
  INGREDIENT_CATEGORIES,
  BaseUnit,
  BASE_UNITS,
} from '../src/index';

describe('@openvelo/types', () => {
  it('exports IngredientCategory with the required values', () => {
    expect(INGREDIENT_CATEGORIES).toEqual([
      IngredientCategory.Meat,
      IngredientCategory.Vegetables,
      IngredientCategory.Dairy,
      IngredientCategory.Grains,
      IngredientCategory.Spices,
      IngredientCategory.Other,
    ]);
  });

  it('exports BaseUnit with the required values', () => {
    expect(BASE_UNITS).toEqual([BaseUnit.g, BaseUnit.ml, BaseUnit.pcs]);
  });
});