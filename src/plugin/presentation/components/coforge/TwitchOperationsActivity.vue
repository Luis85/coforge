<script setup lang="ts">
import { useTwitchOperationsSection } from '../../composables/coforge/use-twitch-operations';
const model = useTwitchOperationsSection();
</script>
<template>
  <section class="cf-twitch-operation-activity" aria-label="Observed Twitch activity">
    <header><div><h2>Live activity</h2><p>Events observed while CoForge is connected. Acknowledging an event does not post a reply.</p></div><button v-if="model.canAuthorize" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.authorize('activity')">Enable activity feed</button></header>
    <label class="cf-field"><span>Filter activity</span><input v-model="model.store.activityFilter" type="search" placeholder="Viewer, event or description" /></label>
    <p v-if="!model.activities.length" class="cf-twitch-operation-empty">No matching Twitch activity has been collected. Connect Twitch and enable the relevant permissions to collect future events.</p>
    <ol v-else class="cf-twitch-operation-timeline">
      <li v-for="activity in model.activities" :key="activity.id">
        <div><strong>{{ activity.summary }}</strong><time :datetime="activity.at">{{ model.time(activity.at) }}</time><small>{{ activity.type }} · channel {{ activity.channelId }}</small><small v-if="activity.linkedIdeaId">Linked to {{ activity.linkedIdeaId }}</small></div>
        <span v-if="activity.acknowledgedAt" class="cf-badge">Acknowledged</span>
        <button v-else type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.acknowledge(activity.id)">Acknowledge</button>
        <details v-if="model.canLink" class="cf-twitch-operation-activity-link"><summary>Link to a screened request</summary><label class="cf-field"><span>Request for {{ activity.summary }}</span><select v-model="model.store.activityLinks[activity.id]"><option value="">Choose a screened request</option><option v-for="idea in model.screenedRequests" :key="idea.id" :value="idea.id">{{ idea.id }} · {{ idea.title }}</option></select></label><button type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy || !model.store.activityLinks[activity.id]" @click="model.linkActivity(activity.id)">Link request</button><p>Linking adds context; it does not change request status or start an agent.</p></details>
      </li>
    </ol>
  </section>
</template>
