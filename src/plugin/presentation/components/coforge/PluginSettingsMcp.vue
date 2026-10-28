<script setup lang="ts">
import { useMcpSettings } from '../../composables/coforge/use-mcp-settings';
import PluginSettingsRow from './PluginSettingsRow.vue';
import CfIcon from './CfIcon.vue';
const model = useMcpSettings();
</script>
<template>
  <section class="cf-mcp-settings" aria-label="Local MCP server">
  <h3 class="cf-setting-heading"><CfIcon name="plug" size="sm" /> Local MCP server</h3>
  <p class="cf-plugin-settings-section-intro">
    Connect an external agent to all CoForge projects in this vault through one MCP server.
    Agents discover projects and choose a project ID for Screen, Score, Plan and Build.
    Plan reads the chosen repository; Build edits a separate worktree. You review the final changes in CoForge.
    Node.js 22 or newer must be on your PATH. Keep this vault and CoForge open while using the tools.
    Activated clients can read requests and use the exposed workflow tools across all projects, including private ones. Viewer visibility still controls viewer-facing surfaces.
  </p>
  <PluginSettingsRow name="Vault MCP connection" class="cf-mcp-setting-row">
    <template #description>
      <p>Activate once to write this vault’s <code>.mcp.json</code> and your user <code>~/.claude.json</code> MCP registration. New projects become available automatically. Existing entries are preserved. Claude may ask you to approve the vault server.</p>
      <p v-if="model.unavailable">MCP activation is available in the desktop plugin.</p>
      <p v-else role="status" aria-live="polite">{{ model.status?.message }}</p>
    </template>
    <button type="button" class="cf-btn cf-btn-primary" :disabled="model.busy || model.unavailable || model.status?.active" @click="model.activate()">
      {{ model.busy ? 'Updating MCP…' : 'Activate MCP' }}
    </button>
    <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.busy || model.unavailable" @click="model.deactivate()">Deactivate MCP</button>
  </PluginSettingsRow>
  <PluginSettingsRow v-if="model.status?.recovery?.length" name="Interrupted workspace" control-id="cf-ps-mcp-recovery" class="cf-mcp-recovery-row">
    <template #description>Open this request in the studio and inspect its saved attempt, diff and worktree. Acknowledge only after verifying the original external client has stopped. This does not rerun or accept code.</template>
    <select id="cf-ps-mcp-recovery" v-model="model.recoveryTaskId" :disabled="model.busy" aria-describedby="cf-ps-mcp-recovery-desc">
      <option v-for="task in model.status.recovery" :key="task.taskId" :value="task.taskId">{{ task.projectId }} · {{ task.ideaId }} · {{ task.step }} · {{ task.taskId }}</option>
    </select>
    <label><input v-model="model.reviewed" type="checkbox" :disabled="model.busy"> I inspected the workspace and stopped the client.</label>
    <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.busy || !model.reviewed" @click="model.recover()">Acknowledge recovery</button>
  </PluginSettingsRow>
  <p v-if="model.error" class="cf-plugin-settings-message is-error" role="alert">{{ model.error }}</p>
  </section>
</template>
