<script setup lang="ts">
import { useTwitchOperationsSection } from '../../composables/coforge/use-twitch-operations';
import { useTwitchOperationsActionFields } from '../../composables/coforge/use-twitch-operations-polish';
import TwitchOperationsFields from './TwitchOperationsFields.vue';
const model = useTwitchOperationsSection();
const fields = useTwitchOperationsActionFields(model);
</script>
<template>
  <section v-if="model.actions.length" class="cf-twitch-operation-editor" aria-label="Channel actions">
    <h2>Channel actions</h2>
    <form aria-label="Twitch action editor" @submit="model.prepare($event)">
      <label class="cf-field"><span>Action</span>
        <select v-model="model.store.action" aria-label="Action" @change="model.setAction(model.store.action)">
          <option v-for="action in model.actions" :key="action.name" :value="action.name">{{ action.label }}</option>
        </select>
      </label>
      <p v-if="model.descriptor?.note" class="cf-twitch-operation-hint">{{ model.descriptor.note }}</p>
      <div v-if="model.showLookup" class="cf-twitch-operation-lookup">
        <label class="cf-field"><span>Find Twitch username</span><input v-model="model.store.username" placeholder="Username without @" /></label>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.canLookup || model.store.busy || !model.store.username.trim()" @click="model.lookupUser()">Resolve account</button>
      </div>
      <TwitchOperationsFields :fields="fields.primary" />
      <details v-if="fields.advanced.length" class="cf-twitch-operation-advanced" aria-label="Limits and redemption options" :open="fields.advancedOpen" @toggle="fields.toggleAdvanced($event)">
        <summary>Limits & redemption options</summary>
        <p>Pause redemptions, require viewer text, or set cooldowns and per-stream limits. Existing draft values are kept when this section closes.</p>
        <TwitchOperationsFields :fields="fields.advanced" />
      </details>
      <p v-if="model.missingActionScopes.length" class="cf-twitch-operation-hint">Additional Twitch permission is required for this action.</p>
      <div class="cf-settings-actions">
        <button type="submit" class="cf-btn cf-btn-primary" :disabled="!model.supported || model.store.busy || model.missingActionScopes.length > 0">Review action</button>
        <button v-if="model.missingActionScopes.length && model.canAuthorize" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.authorize(model.store.action, 'action')">Authorize this action</button>
      </div>
    </form>
    <details v-if="model.canTemplates" class="cf-twitch-operation-templates">
      <summary>Reusable action templates</summary>
      <p>Templates save a draft. Loading one never sends it to Twitch.</p>
      <label class="cf-field"><span>New template name</span><input v-model="model.store.templateName" maxlength="100" /></label>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy || !model.store.templateName.trim()" @click="model.saveTemplate()">Save current draft as template</button>
      <template v-if="model.snapshot.templates?.length">
        <label class="cf-field"><span>Saved template</span><select v-model="model.store.templateId"><option value="">Choose a template</option><option v-for="template in model.snapshot.templates" :key="template.id" :value="template.id">{{ template.name }}</option></select></label>
        <div class="cf-settings-actions"><button type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy || !model.store.templateId" @click="model.loadTemplate()">Load into draft</button><button type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy || !model.store.templateId" @click="model.removeTemplate()">Remove template</button></div>
      </template>
    </details>
    <section v-if="model.store.review" :ref="fields.bindReview" class="cf-twitch-operation-review" aria-label="Review Twitch action" tabindex="-1">
      <h3>{{ model.actionLabel(model.store.review.action.name) }}</h3>
      <p>This action affects Twitch channel <strong>{{ model.store.review.channelId }}</strong>, using account {{ model.store.review.accountId }}.</p>
      <dl><template v-for="(value, key) in model.store.review.action.parameters" :key="key"><dt>{{ model.fieldLabel(key) }}</dt><dd>{{ model.displayValue(value) }}</dd></template></dl>
      <p>The confirmation uses these captured values. Draft edits require a new review.</p>
      <div class="cf-settings-actions">
        <button type="button" data-twitch-confirm class="cf-btn cf-btn-primary" :disabled="model.store.busy" @click="model.confirm()">Confirm on Twitch</button>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.store.review = null">Cancel review</button>
      </div>
    </section>
  </section>
</template>
