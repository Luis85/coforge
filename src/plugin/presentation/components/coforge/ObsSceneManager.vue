<script setup lang="ts">
import { useObsSceneManager } from "../../composables/coforge/use-obs-scene-manager";
import ObsSceneSources from "./ObsSceneSources.vue";
const model = useObsSceneManager();
</script>
<template>
  <details
    class="cf-obs-scene-manager"
    :open="model.store.obsEditorOpen"
    @toggle="model.toggle"
  >
    <summary>OBS scenes and sources</summary>
    <p v-if="model.example" class="cf-settings-help">
      Scene editor example · actions affect in-memory sample scenes only. No
      real OBS connection or broadcast is controlled.
    </p>
    <p v-if="!model.connected">
      Connect OBS in the setup controls to inspect and edit its scenes.
    </p>
    <template v-else>
      <p>
        Choosing a scene here opens its editor. Only the program-switch button
        changes output. Scene/source edits affect OBS immediately, including
        shared or nested sources.
      </p>
      <p v-if="model.uncertain" class="cf-inline-error" role="alert">
        The previous OBS action is unconfirmed. Refresh OBS and sources before
        another change.
      </p>
      <div class="cf-obs-scene-select">
        <label class="cf-field"
          ><span>Scene to edit</span
          ><select
            v-model="model.store.obsEditorScene"
            aria-label="Scene to edit"
            :disabled="model.busy"
          >
            <option
              v-for="scene in model.snapshot?.scenes"
              :key="scene.id"
              :value="scene.id"
            >
              {{ scene.name
              }}{{
                scene.id === model.snapshot?.programSceneId ? " · program" : ""
              }}{{
                scene.id === model.snapshot?.previewSceneId ? " · preview" : ""
              }}
            </option>
          </select></label
        >
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.busy"
          @click="model.refresh()"
        >
          Refresh OBS and sources
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-primary"
          :disabled="
            !model.canMutate ||
            !model.supports('scene-switch') ||
            model.store.obsEditorScene === model.snapshot?.programSceneId
          "
          @click="model.switch()"
        >
          {{
            model.snapshot?.active ? "Take scene live" : "Switch program scene"
          }}
        </button>
      </div>
      <p v-if="model.loading" role="status">Reading scene sources…</p>
      <div class="cf-obs-scene-forms">
        <form @submit="model.create">
          <h3>Create a scene</h3>
          <label class="cf-field"
            ><span>New scene name</span
            ><input
              v-model="model.store.obsNewSceneName"
              maxlength="128"
              required /></label
          ><button
            type="submit"
            class="cf-btn cf-btn-secondary"
            :disabled="
              !model.canMutate ||
              !model.supports('scene-create') ||
              !model.store.obsNewSceneName.trim() ||
              model.nameConflict(model.store.obsNewSceneName)
            "
          >
            Create scene
          </button>
        </form>
        <form @submit="model.rename">
          <h3>Rename selected scene</h3>
          <label class="cf-field"
            ><span>Scene name</span
            ><input
              v-model="model.store.obsRenameSceneName"
              aria-label="Rename scene name"
              maxlength="128"
              required /></label
          ><button
            type="submit"
            class="cf-btn cf-btn-secondary"
            :disabled="
              !model.canMutate ||
              !model.supports('scene-rename') ||
              !model.store.obsRenameSceneName.trim() ||
              model.nameConflict(model.store.obsRenameSceneName)
            "
          >
            Rename scene
          </button>
        </form>
        <form @submit="model.duplicate">
          <h3>Duplicate selected scene</h3>
          <label class="cf-field"
            ><span>Copy name</span
            ><input
              v-model="model.store.obsCopySceneName"
              aria-label="Scene copy name"
              maxlength="128"
              required /></label
          ><button
            type="submit"
            class="cf-btn cf-btn-secondary"
            :disabled="
              !model.canMutate ||
              !model.supports('scene-duplicate') ||
              !model.store.obsCopySceneName.trim() ||
              model.nameConflict(model.store.obsCopySceneName)
            "
          >
            Duplicate scene
          </button>
          <p>
            Copies share existing sources and groups. Layout, crop, visibility,
            order, locks, blend modes and transition overrides are retained
            where supported.
          </p>
        </form>
      </div>
      <template v-if="model.detail"
        ><ObsSceneSources
          :detail="model.detail"
          :disabled="!model.canMutate"
          @visible="model.visible"
          @order="model.order"
          @remove="model.remove"
        />
        <form class="cf-obs-source-add" @submit="model.add">
          <label class="cf-field"
            ><span>Existing source</span
            ><select
              v-model="model.store.obsExistingSource"
              aria-label="Existing source"
              :disabled="!model.canMutate || !model.supports('item-add')"
            >
              <option value="">Choose a source to add</option>
              <option
                v-for="source in model.sources"
                :key="source.id"
                :value="source.id"
              >
                {{ source.name }} · {{ source.kind }}
              </option>
            </select></label
          ><button
            type="submit"
            class="cf-btn cf-btn-secondary"
            :disabled="
              !model.canMutate ||
              !model.supports('item-add') ||
              !model.store.obsExistingSource
            "
          >
            Add existing source
          </button>
        </form>
        <div class="cf-obs-scene-delete">
          <button
            type="button"
            class="cf-btn cf-btn-danger"
            :disabled="
              !model.canMutate ||
              !model.supports('scene-delete') ||
              Boolean(model.blockedDelete)
            "
            @click="model.delete()"
          >
            Delete selected scene
          </button>
          <p v-if="model.blockedDelete">{{ model.blockedDelete }}</p>
        </div>
      </template>
      <section
        v-if="model.confirmation"
        :ref="model.bindConfirmation"
        class="cf-obs-scene-confirm"
        aria-label="Confirm OBS removal"
        tabindex="-1"
        @keydown.esc="model.cancel()"
      >
        <h3>
          {{
            model.confirmation.action.kind === "scene-delete"
              ? "Delete scene"
              : "Remove source from scene"
          }}
        </h3>
        <p>{{ model.confirmation.text }}</p>
        <p v-if="model.snapshot?.active">
          The stream is on air. This removal changes OBS immediately.
        </p>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-danger"
            :disabled="model.busy"
            @click="model.confirm()"
          >
            {{
              model.confirmation.action.kind === "scene-delete"
                ? "Confirm scene deletion"
                : "Confirm source removal"
            }}</button
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            @click="model.cancel()"
          >
            Cancel removal
          </button>
        </div>
      </section>
    </template>
    <p v-if="model.error" role="alert" class="cf-inline-error">
      {{ model.error }}
    </p>
    <p v-if="model.notice" role="status">{{ model.notice }}</p>
  </details>
</template>
