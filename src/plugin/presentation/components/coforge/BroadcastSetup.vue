<script setup lang="ts">
import { useBroadcastModel } from "../../composables/coforge/use-broadcast";
const model = useBroadcastModel();
</script>
<template>
  <div class="cf-broadcast-preparation">
    <section aria-label="Stream readiness">
      <h2>Readiness</h2>
      <ul class="cf-readiness-list">
        <li v-for="check in model.checklist" :key="check.label">
          <div>
            <strong>{{ check.label }}</strong
            ><span>{{
              check.ready ? "Ready" : check.required ? "Needed" : "Optional"
            }}</span>
          </div>
          <p>{{ check.detail }}</p>
        </li>
      </ul>
      <p>
        Twitch chat and a project can be configured independently. Review your
        audio, video and stream destination in OBS before going live.
      </p>
    </section>
    <section aria-label="OBS connection and scenes">
      <h2>OBS setup</h2>
      <p v-if="!model.supported">
        This preview does not connect to OBS. Use these controls inside
        Obsidian.
      </p>
      <form @submit="model.save">
        <label class="cf-field"
          ><span>OBS executable (optional)</span>
          <input
            v-model="model.draft.executable"
            aria-label="OBS executable (optional)"
            type="text"
            maxlength="1000"
            placeholder="Auto-detect installed OBS"
          />
          <small
            >Leave empty to find a standard installation. For portable OBS,
            enter its full executable path.</small
          ></label
        >
        <label class="cf-field"
          ><span>OBS WebSocket URL</span
          ><input
            v-model="model.draft.endpoint"
            type="url"
            maxlength="500"
            required
            placeholder="ws://127.0.0.1:4455/" /></label
        ><label class="cf-project-repository-toggle"
          ><input v-model="model.draft.autoConnect" type="checkbox" /><span
            >Connect OBS when CoForge opens</span
          ></label
        ><label class="cf-field"
          ><span>Go-live scene</span
          ><select v-model="model.draft.liveSceneId">
            <option value="">Choose a scene after connecting</option>
            <option
              v-for="scene in model.scenes"
              :key="scene.id"
              :value="scene.id"
            >
              {{ scene.name }}
            </option>
          </select></label
        ><label class="cf-field"
          ><span>BRB scene</span
          ><select v-model="model.draft.breakSceneId">
            <option value="">No BRB scene</option>
            <option
              v-for="scene in model.scenes"
              :key="scene.id"
              :value="scene.id"
            >
              {{ scene.name }}
            </option>
          </select></label
        ><button
          type="submit"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.supported || model.busy"
        >
          Save OBS setup
        </button>
      </form>
      <div class="cf-obs-password">
        <label class="cf-field"
          ><span>OBS WebSocket password</span
          ><input
            v-model="model.password"
            type="password"
            autocomplete="off"
            maxlength="1000" /></label
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.supported || model.busy || !model.password"
          @click="model.savePassword()"
        >
          Save OBS password
        </button>
        <p>
          Stored in Obsidian secret storage, not in the vault. Enable OBS’s
          WebSocket server under Tools.
        </p>
      </div>
    </section>
  </div>
  <section class="cf-broadcast-channel" aria-label="Twitch setup location">
    <h2>Twitch channel and branding</h2>
    <p>
      Manage the channel connection, title, category, tags and language in
      Twitch settings.
    </p>
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      @click="model.openTwitchSettings()"
    >
      Open Twitch settings
    </button>
  </section>
</template>
