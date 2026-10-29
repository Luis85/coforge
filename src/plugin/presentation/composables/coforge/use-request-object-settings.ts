import { computed, reactive } from 'vue';
import { REQUEST_OBJECT_FIELD_TYPES, REQUEST_OBJECT_LIMITS, type RequestObjectField } from '../../../features/coforge/domain/request-object';
import { useSettingsForm } from './use-settings';
import { changeRequestFieldType, emptyRequestObject, eventText, requestInputValue } from './request-object-draft';
import { requestCategoryNames } from '../../../features/coforge/domain/request-categories';

export function useRequestObjectSettings() {
  const settings = useSettingsForm();
  const ensure = () => settings.draft.requestObject ??= emptyRequestObject();
  return reactive({
    settings,
    className: computed({ get: () => settings.draft.requestObject?.className ?? '', set: value => { ensure().className = value; } }),
    fields: computed(() => settings.draft.requestObject?.fields ?? []),
    categoriesText: computed(() => (settings.draft.requestObject?.categories ?? requestCategoryNames()).join('\n')),
    setCategories: (event: Event) => {
      const value = eventText(event);
      if (value !== undefined) ensure().categories = value.split(/\r?\n/u).map(category => category.trim()).filter(Boolean);
    },
    types: REQUEST_OBJECT_FIELD_TYPES,
    limit: REQUEST_OBJECT_LIMITS.fields,
    add: () => { if (ensure().fields.length < REQUEST_OBJECT_LIMITS.fields) ensure().fields.push({ key: '', label: '', type: 'text' }); },
    remove: (index: number) => { ensure().fields.splice(index, 1); },
    move: (index: number, offset: number) => {
      const fields = ensure().fields;
      if (index + offset < 0 || index + offset >= fields.length) return;
      const field = fields.splice(index, 1)[0];
      if (field) fields.splice(index + offset, 0, field);
    },
    setType: (index: number, event: Event) => {
      const field = ensure().fields[index]; const type = eventText(event);
      if (field && type) ensure().fields[index] = changeRequestFieldType(field, type);
    },
    setOptions: (field: RequestObjectField, event: Event) => {
      const value = eventText(event);
      if (field.type === 'select' && value !== undefined) field.options = value.split(/\r?\n/u).map(option => option.trim()).filter(Boolean);
    },
    setDefault: (index: number, event: Event) => {
      const field = ensure().fields[index]; if (!field) return;
      const value = requestInputValue(field, event);
      if (value === undefined) delete field.defaultValue;
      else if (field.type === 'number' && typeof value === 'number') field.defaultValue = value;
      else if (field.type === 'checkbox' && typeof value === 'boolean') field.defaultValue = value;
      else if (field.type !== 'number' && field.type !== 'checkbox' && typeof value === 'string') field.defaultValue = value;
    },
    clearDefault: (index: number) => { const field = ensure().fields[index]; if (field) delete field.defaultValue; },
  });
}
