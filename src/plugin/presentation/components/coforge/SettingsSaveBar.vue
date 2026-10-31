<script setup lang="ts">
import { useSettingsForm } from '../../composables/coforge/use-settings';
import CfIcon from './CfIcon.vue';
defineProps<{ formId: string }>();
const model = useSettingsForm();
</script>
<template>
  <div class="cf-settings-save">
    <div class="cf-settings-save-message" aria-live="polite">
      <CfIcon :name="model.dirty ? 'circle-alert' : 'circle-check'" size="sm" />
      <span class="cf-notice-body">
        <strong v-if="model.saving">Saving project settings…</strong>
        <strong v-else-if="model.status === 'saved'">Settings saved</strong>
        <strong v-else-if="model.dirty">Unsaved project changes</strong>
        <strong v-else>Project settings are up to date</strong>
        <small v-if="model.pending && !model.metadataOnlyDirty">Finish, stop or review active workflows before saving project changes.</small>
        <small v-else-if="model.dirty">General, Requests and Repository share this save. Workflow settings save separately.</small>
        <small v-else>Saved in this vault. Workflow settings have their own save action.</small>
      </span>
    </div>
    <div class="cf-settings-actions">
      <button class="cf-btn cf-btn-secondary" type="button" :disabled="model.store.busy || model.saving || !model.dirty" @click="model.discard()">Discard changes</button>
      <button class="cf-btn cf-btn-primary" type="submit" :form="formId" :disabled="model.store.busy || model.saving || (model.pending && !model.metadataOnlyDirty) || !model.dirty">
        <CfIcon name="save" size="sm" />{{ model.saving ? 'Saving settings…' : 'Save settings' }}
      </button>
    </div>
  </div>
</template>
