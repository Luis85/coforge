<script setup lang="ts">
import { useSettingsForm, type SettingsModel } from '../../composables/coforge/use-settings';
import CfIcon from './CfIcon.vue';

defineProps<{ fields: SettingsModel['rhythm']; icon: string; heading: string; text: string }>();
const model = useSettingsForm();
</script>
<template>
  <section class="cf-settings-section" :aria-label="heading">
    <div class="cf-settings-description">
      <h2><CfIcon :name="icon" /> {{ heading }}</h2>
      <p>{{ text }}</p>
    </div>
    <div class="cf-settings-fields">
      <div class="cf-settings-fields-grid">
        <label v-for="field in fields" :key="field.key" class="cf-field">
          <span>{{ field.label }}</span>
          <input
            v-model.number="model.draft[field.key]" type="number" :min="field.min" :max="field.max" :step="field.step" required
            inputmode="decimal"
          >
          <small v-if="field.help">{{ field.help }}</small>
        </label>
      </div>
      <slot />
    </div>
  </section>
</template>
