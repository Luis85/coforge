<script setup lang="ts">
import { useSettingsForm } from "../../composables/coforge/use-settings";
import CfIcon from "./CfIcon.vue";
const model = useSettingsForm();
</script>
<template>
  <section class="cf-settings-section" aria-labelledby="cf-project-repository">
    <div class="cf-settings-description">
      <h2 id="cf-project-repository">
        <CfIcon name="folder-git-2" /> Repository &amp; build access
      </h2>
      <p>
        This project’s game files live here. The path may be outside the vault;
        its CoForge project note stays in the vault.
      </p>
    </div>
    <div class="cf-settings-fields">
      <label class="cf-field"
        ><span>Project path</span
        ><input
          v-model="model.draft.projectPath"
          aria-label="Project path"
          type="text"
          maxlength="1000"
          spellcheck="false"
          placeholder="C:/Games/my-game"
        /><small
          >Absolute path to the repository. Planning reads it; builds use a
          separate Git worktree.</small
        ></label
      >
      <label class="cf-field"
        ><span>Git repository URL</span
        ><input
          v-model="model.draft.repositoryUrl"
          type="text"
          inputmode="url"
          maxlength="2000"
          placeholder="Optional"
        /><small
          >A metadata link only. CoForge does not clone or initialize a
          repository.</small
        ></label
      >
      <label class="cf-field"
        ><span>Website URL</span
        ><input
          v-model="model.draft.websiteUrl"
          type="url"
          maxlength="2000"
          placeholder="Optional"
      /></label>
      <label class="cf-field"
        ><span>Worktree folder</span
        ><input
          v-model="model.draft.worktreeFolder"
          type="text"
          maxlength="1000"
          spellcheck="false"
          placeholder="Optional"
        /><small
          >Leave empty to create build worktrees beside the game
          repository.</small
        ></label
      >
      <label class="cf-project-repository-toggle"
        ><input
          v-model="model.draft.allowImplementation"
          type="checkbox"
          :disabled="model.pending"
        /><span>Allow real implementation for this project</span></label
      >
      <p class="cf-settings-help">
        Each build edits a separate worktree. Review its diff and run the game’s
        tests before accepting. CoForge does not commit, merge, push or deploy
        the game.
      </p>
      <p v-if="model.pending" class="cf-settings-help">
        Finish, stop or review this project’s current workflows before saving
        project-wide configuration. Workflow settings can still be saved for
        future runs.
      </p>
    </div>
  </section>
</template>
