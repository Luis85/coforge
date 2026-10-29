<script setup lang="ts">
import { useSchedule } from "../../composables/coforge/use-schedule";
import MarkdownBody from "./MarkdownBody.vue";
const model = useSchedule();
</script>
<template>
  <section class="cf-stream-schedule-page" aria-label="Stream schedule">
    <header class="cf-page-heading">
      <div>
        <h1>Stream schedule</h1>
        <p>
          Plan the show, keep your script, then prepare each tool when you are
          ready.
        </p>
      </div>
      <div class="cf-actions">
        <button
          type="button"
          class="cf-btn"
          :disabled="model.store.busy || !model.available"
          @click="model.refresh"
        >
          Refresh</button
        ><button
          type="button"
          class="cf-btn cf-btn-primary"
          :disabled="model.store.busy || !model.available"
          @click="model.create"
        >
          New stream plan
        </button>
      </div>
    </header>
    <p v-if="!model.available">
      Stream plans are stored in your Obsidian vault.
      <button
        v-if="model.canPreview"
        class="cf-btn"
        type="button"
        @click="model.preview"
      >
        Explore example schedule
      </button>
    </p>
    <p v-if="model.store.example" class="cf-notice">
      Example schedule · no external tools will be changed.
    </p>
    <button
      v-if="model.store.example"
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="model.store.busy"
      title="Discard this temporary example and its edits"
      @click="model.exitExample()"
    >
      Exit example
    </button>
    <p v-if="model.store.error" role="alert">{{ model.store.error }}</p>
    <p v-if="model.store.notice" role="status">{{ model.store.notice }}</p>
    <div v-if="model.available" class="cf-schedule-layout">
      <aside aria-label="Planned streams">
        <h2>
          Your stream plans
          <span class="cf-badge">{{ model.store.notes.length }}</span>
        </h2>
        <p v-if="!model.store.notes.length">
          No stream plans yet. Add a date and topic to start.
        </p>
        <button
          v-for="note in model.store.notes"
          :key="note.plan.id"
          type="button"
          class="cf-schedule-item"
          :aria-current="
            note.plan.id === model.store.selected ? 'true' : undefined
          "
          @click="model.choose(note)"
        >
          <strong>{{ note.plan.name }}</strong
          ><span>{{ model.label(note) }} · {{ note.plan.timezone }}</span
          ><small>{{ note.plan.status }}</small>
        </button>
      </aside>
      <div>
        <form
          class="cf-schedule-form"
          aria-label="Stream plan settings"
          @submit="model.save"
        >
          <h2>
            {{ model.store.expected ? "Edit stream plan" : "New stream plan" }}
          </h2>
          <label
            >Plan name<input
              v-model="model.store.draft.name"
              required
              maxlength="120"
          /></label>
          <div class="cf-schedule-fields">
            <label
              >Start · {{ model.zone
              }}<input
                v-model="model.store.date"
                type="datetime-local"
                required
              /><small
                >During a repeated daylight-saving hour, this selects the
                earlier occurrence.</small
              ></label
            ><label
              >Project<select v-model="model.store.draft.projectId" required>
                <option value="" disabled>Choose a project</option>
                <option
                  v-for="project in model.projects"
                  :key="project.id"
                  :value="project.id"
                >
                  {{ project.settings.projectName }} · {{ project.id }}
                </option>
              </select></label
            >
          </div>
          <h3>Twitch channel</h3>
          <p class="cf-schedule-section-help">
            Save the title and category for this show. Apply them to Twitch
            explicitly after reviewing preparation.
          </p>
          <label
            >Stream title<input
              v-model="model.store.draft.title"
              maxlength="140"
          /></label>
          <div class="cf-schedule-fields">
            <label
              >Category search<input
                v-model="model.store.categoryQuery"
                type="search"
              /><button
                type="button"
                class="cf-btn"
                :disabled="model.store.busy"
                @click="model.searchCategories"
              >
                Search Twitch categories
              </button></label
            ><label
              >Category<select
                :value="model.store.draft.categoryId"
                @change="
                  model.category(($event.target as HTMLSelectElement).value)
                "
              >
                <option :value="model.store.draft.categoryId">
                  {{ model.store.draft.categoryName || "Choose a category" }}
                </option>
                <option
                  v-for="category in model.store.categories"
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.name }}
                </option>
              </select></label
            ><label
              >Tags · comma separated<input
                v-model="model.store.tags"
                placeholder="English, GameDevelopment" /></label
            ><label
              >Language code<input
                v-model="model.store.draft.language"
                placeholder="en"
                maxlength="10"
            /></label>
          </div>
          <h3>OBS and music</h3>
          <p class="cf-schedule-section-help">
            Plan scene assignments and a playlist. Saving a plan does not start
            playback or broadcasting.
          </p>
          <div class="cf-schedule-fields">
            <label
              >Live scene<select v-model="model.store.draft.liveSceneId">
                <option value="">Not configured</option>
                <option
                  v-if="
                    model.store.draft.liveSceneId &&
                    !model.scenes.some(
                      (scene) => scene.id === model.store.draft.liveSceneId,
                    )
                  "
                  :value="model.store.draft.liveSceneId"
                >
                  Saved scene · reconnect OBS to verify
                </option>
                <option
                  v-for="scene in model.scenes"
                  :key="scene.id"
                  :value="scene.id"
                >
                  {{ scene.name }}
                </option>
              </select></label
            ><label
              >BRB scene<select v-model="model.store.draft.breakSceneId">
                <option value="">Not configured</option>
                <option
                  v-if="
                    model.store.draft.breakSceneId &&
                    !model.scenes.some(
                      (scene) => scene.id === model.store.draft.breakSceneId,
                    )
                  "
                  :value="model.store.draft.breakSceneId"
                >
                  Saved scene · reconnect OBS to verify
                </option>
                <option
                  v-for="scene in model.scenes"
                  :key="scene.id"
                  :value="scene.id"
                >
                  {{ scene.name }}
                </option>
              </select></label
            ><label
              >Music playlist<select v-model="model.store.draft.playlistId">
                <option value="">No playlist</option>
                <option
                  v-for="playlist in model.playlists"
                  :key="playlist.id"
                  :value="playlist.id"
                >
                  {{ playlist.name }}
                </option>
              </select></label
            ><label
              >Plan status<select v-model="model.store.draft.status">
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select></label
            >
          </div>
          <div class="cf-actions cf-schedule-save">
            <button
              type="submit"
              class="cf-btn cf-btn-primary"
              :disabled="model.store.busy"
            >
              Save stream plan</button
            ><button
              type="button"
              class="cf-btn"
              :disabled="model.store.busy"
              @click="model.discard"
            >
              Discard changes</button
            ><span v-if="model.dirty">Unsaved changes</span>
          </div>
        </form>
        <section
          v-if="model.selected"
          class="cf-schedule-script"
          aria-label="Stream script"
        >
          <header class="cf-page-heading">
            <h2>Topics and script</h2>
            <button type="button" class="cf-btn" @click="model.open">
              Open Markdown note
            </button>
          </header>
          <MarkdownBody :source="model.selected.body" />
          <p class="cf-muted">
            Edit the note in Obsidian, then refresh here. Plan edits preserve
            your Markdown and other frontmatter.
          </p>
        </section>
        <section
          v-if="model.selected?.plan.status === 'planned'"
          class="cf-schedule-prepare"
          aria-label="Prepare planned stream"
        >
          <h2>Prepare this stream</h2>
          <p>
            Review the saved plan before applying each step. Twitch metadata
            updates your channel immediately; scene assignments require OBS to
            be offline. Music is selected without playing.
          </p>
          <button
            type="button"
            class="cf-btn"
            :disabled="model.store.busy"
            @click="model.review"
          >
            Review saved preparation
          </button>
          <dl v-if="model.store.review">
            <dt>Project</dt>
            <dd>
              {{ model.projectName(model.selected.plan.projectId) }} ·
              {{ model.selected.plan.projectId }}
            </dd>
            <dt>Twitch</dt>
            <dd>
              {{ model.selected.plan.title || "Title not set" }} ·
              {{ model.selected.plan.categoryName || "Category not set" }} ·
              {{ model.selected.plan.language }}<br />{{
                model.selected.plan.tags.join(", ") || "No tags"
              }}
            </dd>
            <dt>Live / BRB scenes</dt>
            <dd>
              {{ model.sceneName(model.selected.plan.liveSceneId) }} /
              {{ model.sceneName(model.selected.plan.breakSceneId) }}
            </dd>
            <dt>Playlist</dt>
            <dd>{{ model.playlistName(model.selected.plan.playlistId) }}</dd>
          </dl>
          <div v-if="model.store.review" class="cf-actions">
            <button
              v-for="step in [
                'project',
                'channel',
                'scenes',
                'playlist',
              ] as const"
              :key="step"
              type="button"
              class="cf-btn"
              :disabled="model.store.busy"
              @click="model.apply(step)"
            >
              {{ model.store.stepResults[step] || "Apply" }} {{ step }}
            </button>
          </div>
          <p>Use Stream studio to finish checks and go live explicitly.</p>
        </section>
      </div>
    </div>
  </section>
</template>
