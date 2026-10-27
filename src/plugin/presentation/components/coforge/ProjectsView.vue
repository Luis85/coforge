<script setup lang="ts">
import { useProjects } from '../../composables/coforge/use-projects';
import CfIcon from './CfIcon.vue';
import MarkdownBody from './MarkdownBody.vue';
const model = useProjects();
</script>
<template>
  <div class="cf-projects-page">
    <header class="cf-page-heading">
      <div><h1>Projects</h1><p>Each project has its own backlog and workspace.</p></div>
      <button type="button" class="cf-btn cf-btn-primary" :disabled="model.store.busy" @click="model.add()"><CfIcon name="plus" /> Add project</button>
    </header>
    <p class="cf-projects-context">Each project has its own backlog. Viewers use <code>!request &lt;project-id&gt; &lt;idea&gt;</code> to choose a parent project. Chat and community are shared; other projects can keep processing in the background.</p>
    <form v-if="model.adding" class="cf-project-create" aria-label="Add project" @submit="model.submit">
      <h2>Add a project</h2>
      <label class="cf-field"><span>Project name</span><input v-model="model.draft.projectName" type="text" required maxlength="80" placeholder="Moon orchard"></label>
      <label class="cf-field">
        <span>Project path</span><input v-model="model.draft.projectPath" type="text" required maxlength="1000" spellcheck="false" placeholder="C:/Games/moon-orchard">
        <small>Absolute path where the game files and agents work. It can be outside this vault; the project note stays in the vault.</small>
      </label>
      <label class="cf-field"><span>Git repository URL</span><input v-model="model.draft.repositoryUrl" type="text" inputmode="url" maxlength="2000" placeholder="Optional · https://github.com/you/game"></label>
      <label class="cf-field"><span>Website URL</span><input v-model="model.draft.websiteUrl" type="url" maxlength="2000" placeholder="Optional · https://my-game.example"></label>
      <label class="cf-field"><span>Description</span><textarea v-model="model.draft.projectBrief" required minlength="10" maxlength="8000" rows="4" placeholder="What are we building together?" /></label>
      <p v-if="model.error" class="cf-inline-error" role="alert">{{ model.error }}</p>
      <div class="cf-settings-actions">
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.cancel()">Cancel</button>
        <button type="submit" class="cf-btn cf-btn-primary" :disabled="model.store.busy">Create project</button>
      </div>
      <p class="cf-settings-help">Saved as a Markdown project note with a stable project ID. Repository URLs are links only; nothing is cloned or initialized. Automation starts paused.</p>
    </form>
    <div class="cf-project-list" aria-label="Your projects">
      <div v-if="!model.rows.length" class="cf-project-empty"><h2>No projects yet</h2><p>Add a project to receive feature requests and bug reports for it.</p>
        <button v-if="!model.sampleConfirm" type="button" class="cf-btn cf-btn-ghost" @click="model.askSample()">Load sample workspace</button>
        <div v-else role="group" aria-label="Confirm sample workspace"><p>This loads illustrative requests and local chat data. No game files are changed.</p><button type="button" class="cf-btn cf-btn-secondary" @click="model.cancelSample()">Cancel</button><button type="button" class="cf-btn cf-btn-secondary" @click="model.loadSample()">Replace with sample</button></div>
      </div>
      <article v-for="project in model.rows" :key="project.id" class="cf-project-row" :class="{ 'is-selected': project.selected }">
        <div class="cf-project-row-content">
          <div class="cf-project-row-title"><h2>{{ project.name }}</h2><code class="cf-readable-project-id">{{ project.id }}</code><span v-if="project.selected" class="cf-badge">Selected</span></div>
          <MarkdownBody :source="project.brief" compact :links="false" />
          <code>{{ project.path || 'Repository not configured' }}</code>
          <div v-if="project.repositoryUrl || project.websiteUrl" class="cf-project-links">
            <a v-if="project.repositoryHref" :href="project.repositoryHref" target="_blank" rel="noopener noreferrer">Git repository</a>
            <code v-else-if="project.repositoryUrl">{{ project.repositoryUrl }}</code>
            <a v-if="project.websiteUrl" :href="project.websiteUrl" target="_blank" rel="noopener noreferrer">Website</a>
          </div>
          <div class="cf-project-metrics"><span>{{ project.requests }} requests</span><span>{{ project.review }} for review</span><span>{{ project.status }}</span><span v-if="project.jobs">{{ project.jobs }} active / queued</span></div>
        </div>
        <div class="cf-settings-actions">
          <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy || project.unavailable" :aria-label="`Settings for ${project.name}`" @click="model.edit(project.id)">Settings</button>
          <button type="button" class="cf-btn cf-btn-primary" :disabled="model.store.busy || project.unavailable" :aria-label="`Open board for ${project.name}`" @click="model.open(project.id)">Open board</button>
        </div>
      </article>
    </div>
    <p class="cf-settings-help">Project notes live in CoForge/Projects. Edit their properties in Obsidian or use each project’s settings. Existing note text and unrelated properties are preserved.</p>
  </div>
</template>
