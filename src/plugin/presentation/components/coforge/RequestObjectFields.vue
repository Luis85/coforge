<script setup lang="ts">
import type { RequestObjectField, RequestFieldValue } from '../../../features/coforge/domain/request-object';
import { useRequestObjectFields, type RequestValueChange } from '../../composables/coforge/use-request-object-fields';
const props = defineProps<{ fields: readonly RequestObjectField[]; values: Readonly<Record<string, RequestFieldValue>>; disabled?: boolean }>();
const emit = defineEmits<{ change: [change: RequestValueChange] }>();
const model = useRequestObjectFields(props, emit);
</script>
<template>
  <div class="cf-request-object-fields">
    <label v-for="field in fields" :key="field.key" class="cf-field" :class="{ 'cf-request-checkbox-field': field.type === 'checkbox' }">
      <template v-if="field.type === 'checkbox'"><input type="checkbox" :checked="model.checked(field)" :disabled="disabled" @change="model.update(field, $event)"><span>{{ field.label }}</span></template>
      <template v-else><span>{{ field.label }}</span><select v-if="field.type === 'select'" :value="model.value(field)" :disabled="disabled" @change="model.update(field, $event)"><option value="">Not provided</option><option v-for="option in field.options" :key="option" :value="option">{{ option }}</option></select><textarea v-else-if="field.type === 'text'" :value="model.value(field)" :maxlength="model.limit" rows="2" :disabled="disabled" @input="model.update(field, $event)"></textarea><input v-else :type="field.type === 'number' ? 'number' : 'date'" :value="model.value(field)" step="any" :disabled="disabled" @input="model.update(field, $event)"></template>
    </label>
  </div>
</template>
