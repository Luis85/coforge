<script setup lang="ts">
import { usePolishingPassSettings } from '../../composables/coforge/use-polishing-pass-settings';
import ProviderModelFields from './ProviderModelFields.vue';
import WorkflowNativeTools from './WorkflowNativeTools.vue';
const fields = usePolishingPassSettings();
</script>
<template>
  <section class="cf-background-build-retry" aria-label="Improve & polish configuration">
    <h3>Improve &amp; polish</h3>
    <p class="cf-settings-help">Configure one optional AI pass for a card’s current result. Each invocation asks for your feedback and review; saving these settings does not run it or advance the main workflow.</p>
    <label class="cf-workflow-check"><input v-model="fields.enabled" type="checkbox" aria-label="Enable Improve & polish" />Enable Improve &amp; polish</label>
    <template v-if="fields.pass">
      <label class="cf-field"><span>Agent configuration</span><select v-model="fields.coworker.mode" aria-label="Improvement agent configuration"><option value="manual">Configure provider, model and effort</option><option value="coworker" :disabled="!fields.coworker.choices.length && fields.pass.coworkerId === undefined">Assign a saved CoWorker</option></select></label>
      <template v-if="fields.coworker.mode === 'coworker'">
        <label class="cf-field"><span>Saved CoWorker</span><select v-model="fields.coworker.selection" aria-label="Improvement CoWorker" data-workflow-field="improvementPass.coworkerId"><option value="">Choose an enabled saved CoWorker</option><option v-for="agent in fields.coworker.choices" :key="agent.id" :value="agent.id">{{ agent.name }}</option><option v-if="fields.coworker.unavailable" :value="fields.pass.coworkerId" disabled>{{ fields.pass.coworkerId }} · unavailable saved CoWorker</option></select></label>
        <p class="cf-settings-help">Each invocation captures the chosen CoWorker’s current role, instructions, provider, model and effort. Missing or disabled profiles do not fall back.</p>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="fields.coworker.loading" @click="fields.coworker.refresh()">Refresh improvement CoWorkers</button>
        <p v-if="fields.coworker.error" class="cf-inline-error" role="status">{{ fields.coworker.error }}</p>
      </template>
      <template v-else>
        <label class="cf-field"><span>Provider</span><select v-model="fields.pass.provider" aria-label="Improvement provider" data-workflow-field="improvementPass.provider"><option v-for="provider in fields.providers" :key="provider.value" :value="provider.value">{{ provider.text }}</option></select></label>
        <ProviderModelFields :choice="fields.pass" model-label="Improvement model" effort-label="Improvement reasoning effort" custom-model-label="Custom improvement model ID" field-prefix="improvementPass" />
      </template>
      <label class="cf-field"><span>Pass instructions</span><textarea v-model="fields.pass.instructions" aria-label="Improvement instructions" data-workflow-field="improvementPass.instructions" rows="5" maxlength="8000" required /><small>Trusted saved task instructions. Feedback is requested separately each time and is captured as untrusted input.</small></label>
      <p class="cf-settings-help" aria-label="Improvement session behavior">{{ fields.sessionHelp }}</p>
      <WorkflowNativeTools :subject="fields.pass" prefix="Improvement" :effective-provider="fields.coworker.effective?.provider" :provider-resolved="fields.coworker.mode === 'manual' || !!fields.coworker.selected" />
    </template>
  </section>
</template>
