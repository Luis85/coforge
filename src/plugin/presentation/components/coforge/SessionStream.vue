<script setup lang="ts">
import type { SessionEventView } from '../../composables/coforge/agent-session-display';
import { useSessionStream } from '../../composables/coforge/use-session-stream';
const props = defineProps<{ entries: SessionEventView[]; selectionKey: string }>();
const stream = useSessionStream(props);
</script>
<template>
  <div class="cf-session-follow">
    <span>{{ stream.following ? 'Following new observations' : 'Follow paused' }}<span v-if="stream.unread"> · {{ stream.unread }} {{ stream.unread === 1 ? 'new update' : 'new updates' }}</span></span>
    <button type="button" class="cf-btn cf-idea-small-button" :class="stream.following ? 'cf-btn-ghost' : 'cf-btn-secondary'" @click="stream.toggle()">{{ stream.following ? 'Pause follow' : 'Resume follow' }}<span v-if="!stream.following && stream.unread"> · {{ stream.unread }}</span></button>
  </div>
  <div :ref="stream.bind" class="cf-session-stream" role="region" aria-label="Recorded session observations" tabindex="0" @scroll="stream.scrolled()" @wheel.passive="stream.wheel($event)" @pointerdown="stream.pointer()" @touchstart.passive="stream.pointer()" @keydown="stream.keydown($event)">
    <ol v-if="entries.length" class="cf-session-events">
      <li v-for="entry in entries" :key="entry.sequence" :data-session-sequence="entry.sequence">
        <div class="cf-session-event-meta"><strong>{{ entry.heading }}</strong><span>{{ entry.actor }}<template v-if="entry.status"> · {{ entry.status }}</template></span><time :datetime="entry.observedAt">{{ entry.timeLabel }}</time></div>
        <pre v-if="entry.text" class="cf-session-message">{{ entry.text }}</pre>
      </li>
    </ol>
    <p v-else class="cf-idea-help">No retained observations for this selection.</p>
  </div>
</template>
