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
import StreamDisplaysPanel from "./StreamDisplaysPanel.vue";
import ObsProductionDesk from "./ObsProductionDesk.vue";
import ObsSourceEditor from "./ObsSourceEditor.vue";
import ObsAudioMixer from "./ObsAudioMixer.vue";
import ObsStudioSetup from "./ObsStudioSetup.vue";
import ObsShowPlan from "./ObsShowPlan.vue";
import ObsOutputHistory from "./ObsOutputHistory.vue";
import ObsLiveSummary from "./ObsLiveSummary.vue";
import ObsOverlayComposer from "./ObsOverlayComposer.vue";
import { useObsProductionSession } from "../../composables/coforge/use-obs-production";
const model = useBroadcast();
const production = useObsProductionSession();
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
    <p v-if="production.ui.error" class="cf-inline-error" role="alert">
      {{ production.ui.error }}
    </p>
    <p v-if="production.ui.notice" role="status">{{ production.ui.notice }}</p>
    <div
      v-show="model.store.broadcastTool === 'live'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Live broadcast"
    >
      <BroadcastControls :model="model" />
      <ObsLiveSummary />
      <ObsProductionDesk />
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
      <ObsStudioSetup />
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
      v-show="model.store.broadcastTool === 'sources'"
      class="cf-subpage-panel"
      role="region"
      aria-label="OBS source and layout workspace"
    >
      <ObsSourceEditor />
    </div>
    <div
      v-show="model.store.broadcastTool === 'audio'"
      class="cf-subpage-panel"
      role="region"
      aria-label="OBS audio workspace"
    >
      <ObsAudioMixer />
    </div>
    <div
      v-show="model.store.broadcastTool === 'show'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Show plan workspace"
    >
      <ObsShowPlan />
    </div>
    <div
      v-show="model.store.broadcastTool === 'displays'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Public capture displays"
    >
      <StreamDisplaysPanel open />
      <ObsOverlayComposer />
    </div>
    <div
      v-show="model.store.broadcastTool === 'history'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Recorded stream history"
    >
      <StreamHistoryPanel />
      <ObsOutputHistory />
    </div>
  </div>
</template>
