<script setup lang="ts">
import type { StreamSurface } from "../../../features/coforge/domain/stream-surfaces";
import type { StreamSurfaceSource } from "../../../features/coforge/application/stream-surface-ports";
import { useStreamSurface } from "../../composables/coforge/use-stream-surface";
import StreamRequestBoard from "./StreamRequestBoard.vue";
import StreamLiveChat from "./StreamLiveChat.vue";
import StreamLeaderboards from "./StreamLeaderboards.vue";
import StreamCommunity from "./StreamCommunity.vue";
const props = defineProps<{
  surface: StreamSurface;
  source: StreamSurfaceSource;
  embedded?: boolean;
}>();
const model = useStreamSurface(props);
</script>
<template>
  <component
    :is="embedded ? 'section' : 'main'"
    class="cf-stream-surface"
    tabindex="0"
    :aria-label="model.title.value"
    :class="[`cf-stream-surface-${surface}`, { 'is-embedded': embedded }]"
  >
    <header class="cf-stream-heading">
      <h1>{{ model.title.value }}</h1>
      <p v-if="surface === 'kanban'" class="cf-stream-project">
        <strong>{{ model.state.value.board.project }}</strong
        ><code v-if="model.state.value.board.projectId">{{
          model.state.value.board.projectId
        }}</code>
      </p>
      <p v-else-if="surface === 'leaderboards'">
        Community support, ideas and accepted changes across projects.
      </p>
      <p v-else-if="surface === 'community'">
        Every contribution helps build the world together.
      </p>
      <p v-else>The community conversation, live from Twitch.</p>
    </header>
    <StreamRequestBoard
      v-if="surface === 'kanban'"
      :board="model.state.value.board"
    />
    <StreamLiveChat
      v-else-if="surface === 'chat'"
      :chat="model.state.value.chat"
    />
    <StreamLeaderboards
      v-else-if="surface === 'leaderboards'"
      :boards="model.boards.value"
      :metric="model.metric"
    />
    <StreamCommunity v-else :community="model.state.value.community" />
    <footer class="cf-stream-participation">
      <strong>Build with us</strong>
      <p>
        <code>!register</code> to join · <code>!help</code> for the guide<span
          v-if="surface === 'kanban' && model.state.value.board.projectId"
        >
          ·
          <code
            >!request {{ model.state.value.board.projectId }} &lt;idea&gt;</code
          >
          · <code>!vote &lt;request-id&gt;</code> to support a request</span
        ><span v-else> · <code>!projects</code> to find a game</span>
      </p>
    </footer>
  </component>
</template>
