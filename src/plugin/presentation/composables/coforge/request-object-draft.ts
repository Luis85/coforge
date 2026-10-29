import { REQUEST_OBJECT_FORMAT, type RequestObjectDefinition, type RequestObjectField, type RequestFieldValue } from '../../../features/coforge/domain/request-object';

export function emptyRequestObject(): RequestObjectDefinition { return { format: REQUEST_OBJECT_FORMAT, className: '', fields: [] }; }
export function copyRequestObject(value: RequestObjectDefinition): RequestObjectDefinition {
  return { ...value, ...(value.categories ? { categories: [...value.categories] } : {}), fields: value.fields.map(field => field.type === 'select' ? { ...field, options: [...field.options] } : { ...field }) };
}
export function eventText(event: Event): string | undefined {
  const target = event.target;
  return target && 'value' in target && typeof target.value === 'string' ? target.value : undefined;
}
export function requestInputValue(field: RequestObjectField, event: Event): RequestFieldValue | undefined {
  const target = event.target;
  if (field.type === 'checkbox') return target && 'checked' in target && typeof target.checked === 'boolean' ? target.checked : undefined;
  const value = eventText(event);
  if (value === undefined || (!value && field.type !== 'text')) return undefined;
  if (field.type === 'number') return Number(value);
  return value;
}
export function changeRequestFieldType(field: RequestObjectField, type: string): RequestObjectField {
  const base = { key: field.key, label: field.label };
  if (type === 'number') return { ...base, type: 'number' };
  if (type === 'date') return { ...base, type: 'date' };
  if (type === 'checkbox') return { ...base, type: 'checkbox' };
  if (type === 'select') return { ...base, type: 'select', options: [] };
  return { ...base, type: 'text' };
}
