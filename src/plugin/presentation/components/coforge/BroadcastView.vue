<script setup lang="ts">
import { useBroadcast } from "../../composables/coforge/use-broadcast";
import { BROADCAST_PAGES } from "../../stores/studio-pages";
import CfSubpageNav from "./CfSubpageNav.vue";
import BroadcastControls from "./BroadcastControls.vue";
import BroadcastSetup from "./BroadcastSetup.vue";
import GuidedStreamSetup from "./GuidedStreamSetup.vue";
import StreamHistoryPanel from "./StreamHistoryPanel.vue";
import LiveStudioPanel from "./LiveStudioPanel.vue";
import ObsSceneManager from "./ObsSceneManager.vue";
import StreamMusic from "./StreamMusic.vue";
import StreamDisplaysPanel from "./StreamDisplaysPanel.vue";
const model = useBroadcast();
</script>
<template>
  <div class="cf-broadcast-page">
    <header class="cf-page-heading">
      <div>
        <h1>Stream studio</h1>
        <p>
          Prepare the show, control the broadcast and keep audience and stream
          health in sight.
        </p>
      </div>
      <div class="cf-settings-actions">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          @click="model.openSetup()"
        >
          Guided setup
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          @click="model.store.openStreamTool('channel')"
        >
          Open stream chat
        </button>
      </div>
    </header>
    <CfSubpageNav
      label="Stream studio pages"
      :items="BROADCAST_PAGES"
      :selected="model.store.broadcastTool"
      @select="model.selectPage($event)"
    />
    <p
      v-if="model.error || model.state.lastError"
      class="cf-inline-error"
      role="alert"
    >
      {{ model.error || model.state.lastError }}
    </p>
    <p v-if="model.notice" role="status">{{ model.notice }}</p>
    <div
      v-show="model.store.broadcastTool === 'live'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Live broadcast"
    >
      <BroadcastControls :model="model" />
      <LiveStudioPanel />
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="model.store.broadcastTool = 'setup'"
      >
        Review stream readiness and setup
      </button>
    </div>
    <div
      v-show="model.store.broadcastTool === 'setup'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Stream preparation"
    >
      <GuidedStreamSetup hide-reopen />
      <BroadcastSetup />
    </div>
    <div
      v-show="model.store.broadcastTool === 'scenes'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Scene management"
    >
      <ObsSceneManager />
    </div>
    <div
      v-show="model.store.broadcastTool === 'music'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Stream music library"
    >
      <StreamMusic open />
    </div>
    <div
      v-show="model.store.broadcastTool === 'displays'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Public capture displays"
    >
      <StreamDisplaysPanel open />
    </div>
    <div
      v-show="model.store.broadcastTool === 'history'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Recorded stream history"
    >
      <StreamHistoryPanel />
    </div>
  </div>
</template>
