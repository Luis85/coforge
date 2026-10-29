<script setup lang="ts">
import { useSettingsForm } from "../../composables/coforge/use-settings";
import CfIcon from "./CfIcon.vue";

const model = useSettingsForm();
</script>
<template>
  <section class="cf-settings-runtime" aria-labelledby="cf-settings-runtime">
    <div class="cf-settings-runtime-heading">
      <h2 id="cf-settings-runtime"><CfIcon name="plug" /> Local connections</h2>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.checking"
        @click="model.checkClaude()"
      >
        <CfIcon
          name="refresh-cw"
          size="sm"
          :class="{ 'cf-spin': model.checking }"
        />
        Check Claude Code
      </button>
    </div>
    <dl class="cf-settings-runtime-list">
      <div>
        <dt>Native Claude Code</dt>
        <dd>
          <span
            class="cf-status-dot"
            :class="{ 'is-active': model.runtime?.cliAvailable }"
          />
          {{ model.runtime?.cliAvailable ? "Available" : "Not detected" }}
        </dd>
      </div>
      <div>
        <dt>Game repository</dt>
        <dd :class="{ 'cf-mono': model.store.activeProject?.projectPath }">
          {{
            model.store.activeProject?.projectPath ||
            "Not configured · set it under Repository"
          }}
        </dd>
      </div>
      <div>
        <dt>Real implementation</dt>
        <dd>
          <span
            class="cf-status-dot"
            :class="{
              'is-active': model.store.activeProject?.allowImplementation,
            }"
          />
          {{
            model.store.activeProject?.allowImplementation
              ? "Enabled for this project"
              : "Disabled for this project"
          }}
        </dd>
      </div>
      <div>
        <dt>Community chat</dt>
        <dd>
          {{
            model.runtime?.chatSource === "twitch"
              ? "Twitch · "
              : "Simulator · "
          }}{{ model.runtime?.chatStatus }}
        </dd>
      </div>
    </dl>
    <div class="cf-settings-actions cf-settings-runtime-actions">
      <button type="button" class="cf-btn cf-btn-secondary" @click="model.store.openSettingsTool('repository')">Configure repository</button>
      <button type="button" class="cf-btn cf-btn-secondary" @click="model.store.openWorkflowTool('herdr')">Manage Herdr workspaces</button>
    </div>
    <p class="cf-settings-help">
      Set the project path and build permission under Repository.
      Configure Herdr under Agent workflow → Herdr workspaces. The native Claude Code executable and
      Twitch connection are configured in
      <strong>Settings → Community plugins → CoForge</strong>. Tokens stay in
      Obsidian’s secret storage.
    </p>
  </section>
</template>
