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
      <div class="cf-workflow-field-grid">
        <label class="cf-field"><span>Foreground timeout · seconds</span><input v-model.number="fields.pass.limits.timeoutSeconds" aria-label="Improvement timeout seconds" data-workflow-field="improvementPass.limits.timeoutSeconds" type="number" min="15" max="1800" required /></label>
        <label class="cf-field"><span>Turns / tool calls</span><input v-model.number="fields.pass.limits.maxTurns" aria-label="Improvement turns/tool calls" data-workflow-field="improvementPass.limits.maxTurns" type="number" min="1" max="50" required /></label>
        <label class="cf-field"><span>Budget cap · USD</span><input v-model.number="fields.pass.limits.maxBudgetUsd" aria-label="Improvement budget USD" data-workflow-field="improvementPass.limits.maxBudgetUsd" type="number" min="0.1" max="20" step="0.01" required /></label>
      </div>
      <p class="cf-settings-help">Text results use the foreground timeout. The reviewed result determines the output contract and project access. Code uses the background policy below and still requires final human review; provider-specific spending enforcement applies.</p>
      <details class="cf-workflow-options"><summary>Code result execution policy</summary>
        <p class="cf-settings-help">No elapsed deadline unless enabled. Inherits {{ fields.pass.limits.maxTurns }} turns/tool calls and USD{{ fields.pass.limits.maxBudgetUsd }} unless explicitly overridden here. These code options are ignored for text results.</p>
        <label class="cf-workflow-check"><input v-model="fields.deadlineEnabled" type="checkbox" aria-label="Set improvement code deadline" />Set an elapsed code deadline</label>
        <label v-if="fields.deadlineEnabled" class="cf-field"><span>Code deadline · hours</span><input v-model.number="fields.deadlineHours" aria-label="Improvement code deadline hours" data-workflow-field="improvementPass.execution.maxRuntimeSeconds" type="number" min="0" step="any" required /><small>Includes elapsed wall time, sleep and disconnected periods.</small></label>
        <label class="cf-workflow-check"><input v-model="fields.idleEnabled" type="checkbox" aria-label="Warn about improvement code inactivity" />Warn about code inactivity</label>
        <label v-if="fields.idleEnabled" class="cf-field"><span>Advisory inactivity warning · minutes</span><input v-model.number="fields.idleMinutes" aria-label="Improvement code inactivity minutes" data-workflow-field="improvementPass.execution.idleWarningSeconds" type="number" min="1" required /><small>Contact does not prove progress, and silence does not terminate a Build.</small></label>
        <label class="cf-workflow-check"><input v-model="fields.turnsEnabled" type="checkbox" aria-label="Override improvement code turn limit" />Override code turns / tool calls</label>
        <label v-if="fields.turnsEnabled" class="cf-field"><span>Code turns / tool calls</span><input v-model.number="fields.turns" aria-label="Improvement code turn limit" data-workflow-field="improvementPass.execution.maxTurns" type="number" min="1" max="100000" required /></label>
        <label class="cf-workflow-check"><input v-model="fields.budgetEnabled" type="checkbox" aria-label="Override improvement code budget" />Override code budget</label>
        <label v-if="fields.budgetEnabled" class="cf-field"><span>Code budget · USD</span><input v-model.number="fields.budget" aria-label="Improvement code budget USD" data-workflow-field="improvementPass.execution.maxBudgetUsd" type="number" min="0.1" max="10000" step="0.01" required /></label>
      </details>
      <WorkflowNativeTools :subject="fields.pass" prefix="Improvement" />
    </template>
  </section>
</template>
