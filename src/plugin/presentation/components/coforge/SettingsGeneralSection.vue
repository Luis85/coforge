<script setup lang="ts">
import { useSettingsForm } from '../../composables/coforge/use-settings';
import CfIcon from './CfIcon.vue';
const model = useSettingsForm();
</script>
<template>
  <section class="cf-settings-section" aria-labelledby="cf-settings-game">
    <div class="cf-settings-description">
      <h2 id="cf-settings-game"><CfIcon name="sliders-horizontal" /> Project details</h2>
      <p>Set the direction for this project and control whether viewers can discover it.</p>
    </div>
    <div class="cf-settings-fields">
      <label class="cf-field">
        <span>Project name</span>
        <input v-model="model.draft.projectName" aria-label="Project name" type="text" maxlength="80" required placeholder="Mosslight" />
      </label>
      <label class="cf-field">
        <span>Project visibility</span>
        <select v-model="model.draft.visibility" aria-label="Project visibility" :aria-describedby="`${model.store.layoutId}-project-visibility-help`">
          <option value="public">Public · eligible for viewer discovery</option>
          <option value="private">Private · owner workspace only</option>
        </select>
        <small :id="`${model.store.layoutId}-project-visibility-help`">Private projects are excluded from public discovery, requests and recognition. Existing Twitch text cannot be recalled. Republish your GitHub Pages site after removing prior local exports.</small>
      </label>
      <p v-if="model.store.activeProject?.visibility !== 'private' && model.store.state?.runtime.publicationDeniedProjectIds?.includes(model.editingProjectId)" class="cf-inline-error" role="status">Publication is blocked for this project. Save an explicit public visibility choice to restore it, or repair storage and reconcile the private project note. Previously deployed pages require republishing.</p>
      <label class="cf-field">
        <span>Description</span>
        <textarea v-model="model.draft.projectBrief" aria-label="Project description" minlength="10" maxlength="8000" rows="5" required placeholder="Describe the game, its audience, mechanics, and what you are building next." :aria-describedby="`${model.store.layoutId}-settings-brief-help`" />
        <small :id="`${model.store.layoutId}-settings-brief-help`">The scoring and planning agents use this brief. Include design goals, scope boundaries and the experience you want to build.</small>
      </label>
      <label class="cf-field">
        <span>General agent prompt</span>
        <textarea v-model="model.draft.agentPrompt" aria-label="General agent prompt" maxlength="8000" rows="5" :aria-describedby="`${model.store.layoutId}-settings-agent-prompt-help`" placeholder="Project conventions and instructions for every agent dispatch" />
        <small :id="`${model.store.layoutId}-settings-agent-prompt-help`">Prefixed to every dispatch for this project. Agent tool restrictions and worktree boundaries still apply.</small>
      </label>
    </div>
  </section>
</template>
