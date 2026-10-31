<script setup lang="ts">
import { useProviderModelFields, type ProviderModelChoice } from '../../composables/coforge/use-provider-model-fields';
const props = defineProps<{ choice: ProviderModelChoice; modelLabel?: string }>();
const fields = useProviderModelFields(props);
</script>
<template>
  <label class="cf-field"><span>{{ modelLabel || 'Model' }}</span>
    <select v-model="fields.model" :aria-label="modelLabel || 'Model'" :data-workflow-field="fields.custom && choice.provider !== 'demo' ? undefined : 'model'" :disabled="choice.provider === 'demo'">
      <option v-for="item in fields.models" :key="item.value" :value="item.value">{{ item.label }}</option>
      <option :value="choice.provider === 'demo' ? choice.model : '__custom'">{{ choice.provider === 'demo' ? 'No model call (simulation)' : 'Custom model ID' }}</option>
    </select>
    <small v-if="choice.provider === 'demo'">Simulation makes no model call; the model is retained for later.</small>
    <small v-else>Documented provider choices. Aliases resolve in your CLI; account access and policy apply.</small>
  </label>
  <label v-if="fields.custom && choice.provider !== 'demo'" class="cf-field"><span>Custom model ID</span>
    <input v-model="fields.customModel" aria-label="Custom model ID" data-workflow-field="model" maxlength="100" required pattern="[a-zA-Z0-9][a-zA-Z0-9._:\-]{0,99}" />
    <small>Use an exact ID supported by your provider. Saved custom IDs are preserved.</small>
  </label>
  <label class="cf-field"><span>Reasoning effort</span>
    <select v-model="fields.effort" aria-label="Reasoning effort" data-workflow-field="effort" :disabled="!fields.efforts.length">
      <option value="">{{ choice.provider === 'demo' ? 'Not used in simulation' : 'Provider default' }}</option>
      <option v-for="effort in fields.efforts" :key="effort" :value="effort">{{ effort === 'xhigh' ? 'Extra high (xhigh)' : effort[0]!.toUpperCase() + effort.slice(1) }}</option>
    </select>
    <small v-if="choice.provider !== 'demo'">{{ fields.efforts.length ? 'Captured for future runs. Higher effort may use more time and tokens.' : 'No documented effort choices for this model. The provider controls its default.' }}</small>
  </label>
  <p v-if="choice.provider === 'codex'" class="cf-settings-help">Codex uses your local sign-in and scoped CoForge tools. The invoking task's captured execution policy applies; its turn setting bounds CoForge tool calls. Claude's USD/turn caps do not enforce Codex spending. Token usage is recorded when available; automatic USD cost is unavailable.</p>
</template>
