<script setup lang="ts">
import { useVerificationIntegrationFields } from '../../composables/coforge/use-verification-integration-fields';
import PluginSettingsRow from './PluginSettingsRow.vue';
const fields = useVerificationIntegrationFields();
</script>
<template>
  <section v-if="fields.profile" aria-label="Isolated workflow verification">
    <h3 class="cf-setting-heading">Isolated workflow verification</h3>
    <p class="cf-plugin-settings-section-intro">Allow selected workflow steps to run the commands you define here in a private Docker source copy. The container has no network, credentials or Git metadata. Its image must already contain the required tools and dependencies; CoForge never pulls an image or runs tests on the host.</p>
    <PluginSettingsRow name="Verification permission">
      <template #description>Disabled by default. Saving grants these commands to future explicitly configured native Claude Code and Codex steps. Existing attempts retain their captured profile.</template>
      <label class="cf-workflow-check"><input v-model="fields.profile.enabled" type="checkbox" aria-label="Enable isolated workflow verification" />Enable isolated verification</label>
    </PluginSettingsRow>
    <PluginSettingsRow name="Docker executable" control-id="cf-ps-verification-docker">
      <template #description>Use Docker on PATH or a native executable path. Runtime and image availability are checked before execution.</template>
      <input id="cf-ps-verification-docker" v-model="fields.profile.dockerBin" type="text" aria-label="Verification Docker executable" aria-describedby="cf-ps-verification-docker-desc" maxlength="1000" spellcheck="false" />
    </PluginSettingsRow>
    <PluginSettingsRow name="Existing local image ID" control-id="cf-ps-verification-image">
      <template #description>Use a Linux image with <code>/usr/local/bin/node</code>, identified by its full <code>sha256:</code> ID. Project dependencies may be prepared in the image at <code>/opt/coforge/node_modules</code>. Host dependencies are never copied; images are not pulled automatically.</template>
      <input id="cf-ps-verification-image" v-model="fields.profile.imageId" type="text" aria-label="Verification image ID" aria-describedby="cf-ps-verification-image-desc" maxlength="1000" spellcheck="false" />
    </PluginSettingsRow>
    <PluginSettingsRow name="Command timeout · seconds" control-id="cf-ps-verification-timeout">
      <template #description>Each command is bounded from 5 to 1800 seconds, within the parent attempt's remaining lifetime.</template>
      <input id="cf-ps-verification-timeout" v-model.number="fields.profile.timeoutSeconds" type="number" min="5" max="1800" step="1" aria-label="Verification command timeout" />
    </PluginSettingsRow>
    <PluginSettingsRow name="Commands per attempt" control-id="cf-ps-verification-runs">
      <template #description>Shared across the parent and its native assistants, from 1 to 32 invocations. Retries count toward this allowance.</template>
      <input id="cf-ps-verification-runs" v-model.number="fields.profile.maxRuns" type="number" min="1" max="32" step="1" aria-label="Maximum verification commands per attempt" />
    </PluginSettingsRow>
    <div v-for="(command, index) in fields.profile.commands" :key="index" class="cf-verification-command">
      <h4>Command {{ index + 1 }}</h4>
      <div class="cf-workflow-field-grid">
        <label class="cf-field"><span>Command ID</span><input v-model="command.id" aria-label="Command ID" maxlength="80" spellcheck="false" /></label>
        <label class="cf-field"><span>Label</span><input v-model="command.label" aria-label="Command label" maxlength="200" /></label>
      </div>
      <label class="cf-field"><span>Executable inside the image</span><input v-model="command.executable" aria-label="Command executable" maxlength="1000" spellcheck="false" /></label>
      <label class="cf-field"><span>Arguments · one per line</span><textarea :value="fields.arguments(command)" rows="3" aria-label="Command arguments" spellcheck="false" @input="fields.setArguments(command, $event)" /><small>These are literal arguments, not a shell command. Workflow instructions cannot change this command.</small></label>
      <button type="button" class="cf-btn cf-btn-ghost" :aria-label="`Remove verification command ${index + 1}`" @click="fields.remove(index)">Remove command</button>
    </div>
    <p v-if="!fields.profile.commands.length" class="cf-settings-help">No commands configured. Add a command before enabling verification, then select its ID in a workflow step.</p>
    <button type="button" class="cf-btn cf-btn-secondary" :disabled="fields.profile.commands.length >= 16" @click="fields.add()">Add verification command</button>
  </section>
</template>
