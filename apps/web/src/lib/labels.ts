import { BaseUnit, BASE_UNIT_LABELS, INGREDIENT_CATEGORY_LABELS, IngredientCategory } from '@openvelo/types';

export function formatUnit(unit: BaseUnit): string {
  return BASE_UNIT_LABELS[unit];
}

export function formatIngredientLabel(name: string): string {
  return name;
}

export function formatIngredientCategory(category: IngredientCategory): string {
  return INGREDIENT_CATEGORY_LABELS[category];
}
