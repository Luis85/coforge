<script setup lang="ts">
import { useStreamDisplays } from "../../composables/coforge/use-stream-displays";
import StreamSurfaceView from "./StreamSurfaceView.vue";
const model = useStreamDisplays();
</script>
<template>
  <details class="cf-stream-displays">
    <summary>Public stream displays</summary>
    <p>
      Open a new read-only tab in the main workspace from here or its Obsidian
      ribbon icon. To capture it in OBS, detach that tab into its own window
      using Obsidian’s tab menu. Keep the private studio outside your capture.
    </p>
    <p>
      Detached window names stay fixed when you change projects. Public windows
      pause if another pane or dialog appears, and close when CoForge unloads.
      After a reload, reopen a public tab and detach it again for capture.
    </p>
    <p>
      The Kanban display stays pinned to its chosen project while you work
      elsewhere.
    </p>
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="!model.canOpen"
      @click="model.showProject()"
    >
      Show selected project on stream Kanban
    </button>
    <div class="cf-stream-display-list">
      <section v-for="definition in model.definitions" :key="definition.id">
        <h3>{{ definition.label }}</h3>
        <code>{{ definition.title }}</code>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="!model.canOpen"
            @click="model.open(definition.id)"
          >
            Open {{ definition.label }} tab</button
          ><button
            v-if="model.source"
            type="button"
            class="cf-btn cf-btn-ghost"
            @click="model.showPreview(definition.id)"
          >
            Preview {{ definition.label }}
          </button>
        </div>
      </section>
    </div>
    <section
      v-if="model.preview && model.source"
      class="cf-stream-display-preview"
      aria-label="Public display preview"
    >
      <p>
        Preview only. These surrounding studio controls are private; capture the
        detached public window instead.
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="model.closePreview()"
      >
        Close public display preview</button
      ><StreamSurfaceView
        embedded
        :surface="model.preview"
        :source="model.source"
        :key="model.preview"
      />
    </section>
    <p v-if="model.error" role="alert" class="cf-inline-error">
      {{ model.error }}
    </p>
  </details>
</template>
