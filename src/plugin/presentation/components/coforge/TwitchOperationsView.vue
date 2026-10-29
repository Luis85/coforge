<script setup lang="ts">
import { useTwitchOperations } from '../../composables/coforge/use-twitch-operations';
import TwitchOperationsAction from './TwitchOperationsAction.vue';
import TwitchOperationsActivity from './TwitchOperationsActivity.vue';
import TwitchOperationsData from './TwitchOperationsData.vue';
import TwitchOperationsRecords from './TwitchOperationsRecords.vue';
import TwitchAuthorization from './TwitchAuthorization.vue';
import TwitchOperationsReport from './TwitchOperationsReport.vue';
import TwitchOperationsHistory from './TwitchOperationsHistory.vue';
import TwitchOperationsBroadcast from './TwitchOperationsBroadcast.vue';
const model = useTwitchOperations();
</script>
<template>
  <div class="cf-twitch-operations-page" :aria-busy="model.store.busy">
    <header class="cf-page-heading"><div><h1>Twitch operations</h1><p>Manage channel activity, community interactions and the work around your broadcast.</p></div><span class="cf-badge">{{ model.channel }}</span></header>
    <p v-if="!model.supported" class="cf-twitch-operation-empty">Live Twitch operations are available in Obsidian. Connect your streamer account in Twitch settings.</p>
    <nav class="cf-subpage-nav" aria-label="Twitch operation tools"><button v-for="page in model.pages" :key="page.id" type="button" :data-twitch-page="page.id" :aria-current="model.store.page === page.id ? 'page' : undefined" @click="model.setPage(page.id)">{{ page.label }}</button></nav>
    <p v-if="model.store.error" role="alert" class="cf-twitch-operation-error">{{ model.store.error }}</p>
    <p v-if="model.store.notice" role="status" class="cf-twitch-operation-notice">{{ model.store.notice }}</p>
    <TwitchAuthorization v-if="model.authorizing" :client-id="model.connection.twitchClientId" :uses-streamer="model.connection.twitchBotUsesStreamer" />
    <section v-if="model.pending.length" class="cf-twitch-operation-recovery" aria-label="Twitch actions needing inspection">
      <h2>{{ model.pending.length }} {{ model.pending.length === 1 ? 'action needs' : 'actions need' }} inspection</h2><p>Twitch did not confirm these outcomes. Inspect the channel before another action. Nothing here is replayed automatically.</p>
      <div v-for="intent in model.pending" :key="intent.id">
        <h3>{{ model.actionLabel(intent.action.name) }}</h3><p>Channel {{ intent.channelId }} · {{ model.time(intent.createdAt) }} · {{ intent.status }}</p>
        <p v-if="intent.error">{{ intent.error }}</p>
        <label class="cf-field"><span>Inspection note for {{ intent.id }}</span><input v-model="model.store.recoveryNotes[intent.id]" placeholder="What did you verify on Twitch?" /></label>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy || !model.store.recoveryNotes[intent.id]?.trim()" @click="model.reconcile(intent.id)">Record inspection</button>
      </div>
    </section>
    <p v-if="model.snapshot.gaps.length && model.store.page !== 'data'" class="cf-twitch-operation-coverage">{{ model.snapshot.gaps.length }} collection {{ model.snapshot.gaps.length === 1 ? 'gap' : 'gaps' }} recorded. Events missed while disconnected cannot be replayed. Inspect Data & access for coverage.</p>
    <TwitchOperationsData v-if="model.store.page === 'data'" />
    <template v-else>
      <TwitchOperationsActivity v-if="model.store.page === 'activity'" />
      <TwitchOperationsReport v-if="model.store.page === 'content'" />
      <TwitchOperationsBroadcast v-if="model.store.page === 'broadcast'" />
      <section v-if="model.store.page === 'schedule'" class="cf-twitch-operation-plan" aria-label="Publish a local stream plan">
        <h2>Publish a planned broadcast</h2><p>Choose a local plan to prepare a public Twitch schedule entry. Publishing is optional and requires a separate confirmation.</p>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.canLoadPlans || model.store.busy" @click="model.loadPlans()">Load local stream plans</button>
        <label v-if="model.store.localPlans.length" class="cf-field"><span>Local stream plan</span><select v-model="model.store.selectedPlan" @change="model.selectPlan()"><option value="">Choose a plan</option><option v-for="note in model.store.localPlans" :key="note.plan.id" :value="note.plan.id">{{ note.plan.name }} · {{ model.time(note.plan.startsAt) }}</option></select></label>
      </section>
      <div class="cf-twitch-operation-workspace">
        <TwitchOperationsRecords />
        <TwitchOperationsAction />
      </div>
    </template>
    <TwitchOperationsHistory />
  </div>
</template>
