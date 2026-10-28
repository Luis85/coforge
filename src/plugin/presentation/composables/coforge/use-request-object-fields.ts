import type { RequestObjectField, RequestFieldValue } from '../../../features/coforge/domain/request-object';
import { REQUEST_OBJECT_LIMITS } from '../../../features/coforge/domain/request-object';
import { requestInputValue } from './request-object-draft';
export interface RequestValueChange { key: string; value: RequestFieldValue | undefined }
export function useRequestObjectFields(props: { values: Readonly<Record<string, RequestFieldValue>> }, emit: (event: 'change', change: RequestValueChange) => void) {
  return {
    limit: REQUEST_OBJECT_LIMITS.text,
    value: (field: RequestObjectField) => {
      const value = props.values[field.key];
      return typeof value === 'boolean' ? String(value) : value ?? '';
    },
    checked: (field: RequestObjectField) => props.values[field.key] === true,
    update: (field: RequestObjectField, event: Event) => emit('change', { key: field.key, value: requestInputValue(field, event) }),
  };
}
