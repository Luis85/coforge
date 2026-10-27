<script setup lang="ts">
import { useBroadcast } from "../../composables/coforge/use-broadcast";
import TwitchChannelEditor from "./TwitchChannelEditor.vue";
import GuidedStreamSetup from './GuidedStreamSetup.vue';
import StreamHistoryPanel from './StreamHistoryPanel.vue';
import LiveStudioPanel from './LiveStudioPanel.vue';
import ObsSceneManager from './ObsSceneManager.vue';
import StreamMusic from './StreamMusic.vue';
const model = useBroadcast();
</script>
<template>
  <div class="cf-broadcast-page">
    <header class="cf-page-heading">
      <div>
        <h1>Stream studio</h1>
        <p>Prepare the channel and OBS, then go live.</p>
      </div>
      <button type="button" class="cf-btn cf-btn-secondary" @click="model.store.navigate('stream')">
        Open stream chat
      </button>
    </header>
    <GuidedStreamSetup />
    <section class="cf-broadcast-console" aria-label="Broadcast controls">
      <div>
        <span class="cf-broadcast-state" :class="{ 'is-live': model.active }">{{
          model.state.uncertain ? "CHECK OBS" : model.active ? "LIVE" : model.connected ? "OFF AIR" : "OBS"
        }}</span>
        <h2 role="status">{{ model.title }}</h2>
        <p>
          {{ model.connected && !model.state.uncertain ? "Program scene" : "Last observed scene" }}:
          <strong>{{ model.currentScene }}</strong
          ><span v-if="model.active && model.state.snapshot?.timecode"> · {{ model.elapsed }}</span>
        </p>
      </div>
      <div class="cf-broadcast-actions">
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.canPrepare" @click="model.prepare()">
          Prepare stream</button
        ><button
          type="button"
          class="cf-btn cf-btn-primary cf-go-live"
          :disabled="!model.canGoLive"
          @click="model.goLive()"
        >
          Go live</button
        ><button
          v-if="!model.state.onBreak"
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.canPause"
          @click="model.pause()"
        >
          Pause / BRB</button
        ><button
          v-else
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.canResume"
          @click="model.resume()"
        >
          Resume stream</button
        ><button type="button" class="cf-btn cf-btn-danger" :disabled="!model.canStop" @click="model.stop()">
          Stop stream
        </button>
      </div>
      <p>
        Go live starts broadcasting through OBS. Pause switches scenes while the stream stays live. OBS owns your stream
        destination and output credentials.
      </p>
      <p v-if="model.state.uncertain" class="cf-inline-error" role="alert">
        The previous interaction is unconfirmed. Refresh OBS state before another stream action.
      </p>
      <div class="cf-settings-actions">
        <button
          v-if="!model.connected"
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.supported || model.busy"
          @click="model.open()"
        >
          Open OBS Studio
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.supported || model.busy || !model.connected"
          @click="model.refresh()"
        >
          Refresh OBS state</button
        ><button
          v-if="!model.connected"
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="!model.supported || model.busy"
          @click="model.connect()"
        >
          Connect OBS</button
        ><button v-else type="button" class="cf-btn cf-btn-ghost" :disabled="model.busy" @click="model.disconnect()">
          Disconnect OBS
        </button>
      </div>
    </section>
    <p v-if="model.error || model.state.lastError" class="cf-inline-error" role="alert">
      {{ model.error || model.state.lastError }}
    </p>
    <p v-if="model.notice" role="status">{{ model.notice }}</p>
    <LiveStudioPanel />
    <ObsSceneManager />
    <StreamMusic />
    <div class="cf-broadcast-preparation">
      <section aria-label="Stream readiness">
        <h2>Readiness</h2>
        <ul class="cf-readiness-list">
          <li v-for="check in model.checklist" :key="check.label">
            <div>
              <strong>{{ check.label }}</strong
              ><span>{{ check.ready ? "Ready" : check.required ? "Needed" : "Optional" }}</span>
            </div>
            <p>{{ check.detail }}</p>
          </li>
        </ul>
        <p>
          Twitch chat and a project can be configured independently. Review your audio, video and stream destination in
          OBS before going live.
        </p>
      </section>
      <section aria-label="OBS connection and scenes">
        <h2>OBS setup</h2>
        <p v-if="!model.supported">This preview does not connect to OBS. Use these controls inside Obsidian.</p>
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
              >Leave empty to find a standard installation. For portable OBS, enter its full executable path.</small
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
              <option v-for="scene in model.scenes" :key="scene.id" :value="scene.id">{{ scene.name }}</option>
            </select></label
          ><label class="cf-field"
            ><span>BRB scene</span
            ><select v-model="model.draft.breakSceneId">
              <option value="">No BRB scene</option>
              <option v-for="scene in model.scenes" :key="scene.id" :value="scene.id">{{ scene.name }}</option>
            </select></label
          ><button type="submit" class="cf-btn cf-btn-secondary" :disabled="!model.supported || model.busy">
            Save OBS setup
          </button>
        </form>
        <div class="cf-obs-password">
          <label class="cf-field"
            ><span>OBS WebSocket password</span
            ><input v-model="model.password" type="password" autocomplete="off" maxlength="1000" /></label
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="!model.supported || model.busy || !model.password"
            @click="model.savePassword()"
          >
            Save OBS password
          </button>
          <p>Stored in Obsidian secret storage, not in the vault. Enable OBS’s WebSocket server under Tools.</p>
        </div>
      </section>
    </div>
    <details class="cf-broadcast-channel">
      <summary>Twitch channel and branding</summary>
      <TwitchChannelEditor />
    </details>
    <StreamHistoryPanel />
  </div>
</template>
