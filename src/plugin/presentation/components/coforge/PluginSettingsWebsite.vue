<script setup lang="ts">
import { usePluginSettingsForm } from '../../composables/coforge/use-plugin-settings';
import CfIcon from './CfIcon.vue';
import PluginSettingsRow from './PluginSettingsRow.vue';

const model = usePluginSettingsForm();
</script>
<template>
  <h3 class="cf-setting-heading"><CfIcon name="globe" size="sm" /> Viewer website (GitHub Pages)</h3>
  <p class="cf-plugin-settings-section-intro">
    Viewers can follow the idea board and leaderboards on a read-only page. CoForge writes a static page, its stylesheet and
    <code>board.json</code> into a vault folder; a GitHub Actions workflow publishes that folder to GitHub Pages whenever it changes on
    <code>main</code>. CoForge never commits or pushes: publishing happens when you push the vault repository. The page shows screened ideas,
    vote counts, scores, plans, display names and badges — never chat, platform user IDs, run logs, review notes, flagged or archived requests.
  </p>
  <PluginSettingsRow name="Viewer board folder" control-id="cf-ps-public-folder">
    <template #description>Vault-relative folder that is deployed as the website, for example <code>CoForge/Public</code>.</template>
    <input
      id="cf-ps-public-folder" v-model="model.draft.publicFolder" type="text" spellcheck="false" maxlength="200" required
      placeholder="CoForge/Public" aria-describedby="cf-ps-public-folder-desc"
    >
  </PluginSettingsRow>
  <PluginSettingsRow name="Keep the viewer board updated" control-id="cf-ps-public-enabled">
    <template #description>Rewrites the board files a few seconds after the board changes. Unchanged boards are not rewritten.</template>
    <label class="cf-plugin-settings-toggle" :class="{ 'is-enabled': model.draft.publicBoardEnabled }">
      <input
        id="cf-ps-public-enabled" v-model="model.draft.publicBoardEnabled" type="checkbox" role="switch"
        aria-describedby="cf-ps-public-enabled-desc"
      >
      <span aria-hidden="true" />
    </label>
  </PluginSettingsRow>
  <PluginSettingsRow name="Publish" control-id="cf-ps-public-publish">
    <template #description>
      <strong>Set up GitHub Pages</strong> writes <code>.github/workflows/coforge-pages.yml</code> at the root of the vault’s Git repository
      (an existing file that CoForge did not create is never replaced) and writes the board once. Then commit, push to <code>main</code> and
      choose <em>GitHub Actions</em> as the Pages source in the repository settings.
      <span v-if="model.website" class="cf-plugin-settings-runtime" role="status">{{ model.website }}</span>
    </template>
    <div class="cf-plugin-settings-token">
      <button id="cf-ps-public-publish" type="button" class="cf-btn cf-btn-secondary" :disabled="model.publishing" @click="model.publish()">
        <CfIcon name="upload" size="sm" /> Write board now
      </button>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.publishing" @click="model.setupPages()">
        <CfIcon name="git-branch" size="sm" /> Set up GitHub Pages
      </button>
    </div>
  </PluginSettingsRow>
</template>
