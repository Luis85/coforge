<script setup lang="ts">
import type { TwitchOperationField } from '../../../features/coforge/domain/twitch-operations';
import { useTwitchOperationsSection } from '../../composables/coforge/use-twitch-operations';
defineProps<{ fields: readonly TwitchOperationField[] }>();
const model = useTwitchOperationsSection();
</script>
<template>
  <div class="cf-twitch-operation-fields">
    <label v-for="field in fields" :key="`${model.store.action}-${field.name}`" class="cf-field">
      <span>{{ field.label }}<span v-if="!field.required" class="cf-twitch-operation-optional"> · optional</span></span>
      <select v-if="field.type === 'boolean'" v-model="model.draft[field.name]" :data-twitch-field="field.name" :required="field.required">
        <option value="">{{ field.required ? 'Choose a value' : 'Leave unchanged' }}</option><option value="true">Yes</option><option value="false">No</option>
      </select>
      <select v-else-if="field.type === 'select'" v-model="model.draft[field.name]" :data-twitch-field="field.name" :required="field.required">
        <option v-if="!field.required" value="">Leave unchanged</option><option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
      </select>
      <textarea v-else-if="field.type === 'list'" v-model="model.draft[field.name]" :data-twitch-field="field.name" :required="field.required" rows="4" />
      <input v-else v-model="model.draft[field.name]" :type="field.type === 'number' ? 'number' : 'text'" :data-twitch-field="field.name" :required="field.required" :min="field.type === 'number' ? field.min : undefined" :max="field.type === 'number' ? field.max : undefined" :maxlength="field.type === 'text' ? field.max : undefined" />
      <small v-if="field.hint">{{ field.hint }}</small>
    </label>
  </div>
</template>
