import { list, text } from './check';
import { cleanLine } from './sanitize';
import { CATEGORIES } from './types';

export function categoryNameCheck(value: unknown): string {
  return text({ min: 1, max: 80, trim: true })(cleanLine(text({ min: 1, max: 80, trim: true })(value)));
}
export function requestCategoriesCheck(value: unknown): string[] {
  const categories = list(categoryNameCheck, { min: 1, max: 40 })(value);
  if (new Set(categories.map(category => category.toLowerCase())).size !== categories.length)
    throw new Error('Request categories must be unique.');
  return categories;
}
export function requestCategoryNames(source?: { categories?: readonly string[] }): string[] {
  return source?.categories ? requestCategoriesCheck(source.categories) : [...CATEGORIES];
}
