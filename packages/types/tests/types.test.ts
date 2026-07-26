import { describe, it, expect } from 'vitest';
import {
  IngredientCategory,
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_LABELS,
  BaseUnit,
  BASE_UNITS,
  BASE_UNIT_LABELS,
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

  it('exports INGREDIENT_CATEGORY_LABELS for every category', () => {
    for (const category of INGREDIENT_CATEGORIES) {
      expect(typeof INGREDIENT_CATEGORY_LABELS[category]).toBe('string');
      expect(INGREDIENT_CATEGORY_LABELS[category].length).toBeGreaterThan(0);
    }
    expect(Object.keys(INGREDIENT_CATEGORY_LABELS).sort()).toEqual(
      [...INGREDIENT_CATEGORIES].sort(),
    );
  });

  it('exports BASE_UNIT_LABELS for every base unit', () => {
    for (const unit of BASE_UNITS) {
      expect(typeof BASE_UNIT_LABELS[unit]).toBe('string');
      expect(BASE_UNIT_LABELS[unit].length).toBeGreaterThan(0);
    }
    expect(Object.keys(BASE_UNIT_LABELS).sort()).toEqual([...BASE_UNITS].sort());
  });
});